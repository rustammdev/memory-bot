/**
 * Search Pipeline — Orchestrates multi-strategy retrieval
 *
 * Flow: Query Expansion → Parallel Retrieval (vector + keyword + expanded) → RRF Fusion → MMR Rerank → Context Expansion
 *
 * This is the premium search engine that combines:
 * 1. LLM query expansion (multi-angle search)
 * 2. Hybrid retrieval (semantic + full-text keyword)
 * 3. Reciprocal Rank Fusion (merging multiple ranked lists)
 * 4. MMR diversity (avoiding redundant results)
 * 5. Context window expansion (surrounding text for richer snippets)
 * 6. Confidence classification (high/medium/low with source tracking)
 */

import { embedText, embedTexts } from "./embedder";
import {
  vectorSearchEnriched,
  vectorSearchEnrichedMulti,
  keywordSearch,
  keywordSearchMulti,
  fetchAdjacentChunks,
  type EnrichedChunk,
  type MultiEnrichedChunk,
  type KeywordHit,
  type MultiKeywordHit,
} from "./store";
import { expandQuery, type ExpandedQuery } from "./query-expander";
import {
  rerank,
  type FusionCandidate,
  type RankedResult,
  type MatchSource,
  type Confidence,
} from "./reranker";
import {
  MIN_SIMILARITY,
  MAX_PER_VIDEO,
  DEFAULT_RESULT_LIMIT,
  RETRIEVAL_MULTIPLIER,
} from "./search-constants";
import { createLogger } from "../lib/logger";
import { processWithConcurrency } from "../lib/concurrency";

const log = createLogger("search-pipeline");

export interface PipelineResult {
  readonly content: string;
  readonly expandedContent: string | null;
  readonly videoId: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly similarity: number;
  readonly score: number;
  readonly confidence: Confidence;
  readonly sources: ReadonlyArray<MatchSource>;
  readonly startSec: number | null;
}

export interface MultiPipelineResult extends PipelineResult {
  readonly channelId: string;
  readonly channelName: string;
}

export interface PipelineOptions {
  readonly limit?: number;
  readonly minSimilarity?: number;
  readonly maxPerVideo?: number;
  readonly expandQueries?: boolean;
  readonly includeContext?: boolean;
}

export interface PipelineMetrics {
  readonly totalCandidates: number;
  readonly vectorHits: number;
  readonly keywordHits: number;
  readonly expandedHits: number;
  readonly queryExpansion: ExpandedQuery | null;
  readonly durationMs: number;
}

export interface PipelineResponse<T extends PipelineResult> {
  readonly results: ReadonlyArray<T>;
  readonly metrics: PipelineMetrics;
}

// ─── Defaults ──────────────────────────────────────────────────────

// ─── Candidate ID Generation ───────────────────────────────────────

function candidateId(transcriptId: string, chunkIndex: number): string {
  return `${transcriptId}:${chunkIndex}`;
}

// ─── Convert Retrieval Results to Candidates ───────────────────────

function vectorToCandidate(chunk: EnrichedChunk, source: MatchSource): FusionCandidate {
  return {
    id: candidateId(chunk.transcriptId, chunk.chunkIndex),
    content: chunk.content,
    videoId: chunk.videoId,
    videoTitle: chunk.videoTitle,
    videoUrl: chunk.videoUrl,
    transcriptId: chunk.transcriptId,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
    importance: chunk.importance,
    videoViewCount: chunk.videoViewCount,
    startSec: chunk.startSec,
    source,
  };
}

function multiVectorToCandidate(chunk: MultiEnrichedChunk, source: MatchSource): FusionCandidate {
  return {
    ...vectorToCandidate(chunk, source),
    channelId: chunk.channelId,
    channelName: chunk.channelName,
  };
}

function keywordToCandidate(hit: KeywordHit): FusionCandidate {
  return {
    id: candidateId(hit.transcriptId, hit.chunkIndex),
    content: hit.content,
    videoId: hit.videoId,
    videoTitle: hit.videoTitle,
    videoUrl: hit.videoUrl,
    transcriptId: hit.transcriptId,
    chunkIndex: hit.chunkIndex,
    similarity: 0,
    importance: hit.importance,
    videoViewCount: hit.videoViewCount,
    startSec: hit.startSec,
    source: "keyword",
  };
}

function multiKeywordToCandidate(hit: MultiKeywordHit): FusionCandidate {
  return {
    ...keywordToCandidate(hit),
    channelId: hit.channelId,
    channelName: hit.channelName,
  };
}

// ─── Context Expansion ─────────────────────────────────────────────

async function expandContext(
  results: ReadonlyArray<RankedResult>,
): Promise<ReadonlyArray<{ result: RankedResult; expanded: string | null }>> {
  const output: Array<{ result: RankedResult; expanded: string | null }> = new Array(results.length);

  await processWithConcurrency(
    results.map((r, i) => ({ r, i })),
    5,
    async ({ r, i }) => {
      try {
        const adjacent = await fetchAdjacentChunks(r.transcriptId, r.chunkIndex, 1);
        if (adjacent.length === 0) {
          output[i] = { result: r, expanded: null };
          return;
        }

        const before = adjacent.filter((a) => a.chunkIndex < r.chunkIndex);
        const after = adjacent.filter((a) => a.chunkIndex > r.chunkIndex);

        const parts: string[] = [];
        if (before.length > 0) parts.push(before.map((a) => a.content).join(" "));
        parts.push(r.content);
        if (after.length > 0) parts.push(after.map((a) => a.content).join(" "));

        output[i] = { result: r, expanded: parts.join("\n\n") };
      } catch (err) {
        log.warn("context expansion failed", { transcriptId: r.transcriptId, err: String(err) });
        output[i] = { result: r, expanded: null };
      }
    },
  );

  return output;
}

// ─── Single-Channel Pipeline ───────────────────────────────────────

export async function searchChannel(
  channelId: string,
  query: string,
  opts: PipelineOptions = {},
): Promise<PipelineResponse<PipelineResult>> {
  const start = performance.now();
  const limit = opts.limit ?? DEFAULT_RESULT_LIMIT;
  const minSimilarity = opts.minSimilarity ?? MIN_SIMILARITY;
  const maxPerVideo = opts.maxPerVideo ?? MAX_PER_VIDEO;
  const shouldExpand = opts.expandQueries ?? true;
  const includeContext = opts.includeContext ?? true;
  const fetchLimit = limit * RETRIEVAL_MULTIPLIER;

  const done = log.time(`pipeline channel=${channelId.slice(0, 8)}`);

  // Step 1: Query expansion (parallel with original embedding)
  const [expansion, originalEmbedding] = await Promise.all([
    shouldExpand ? expandQuery(query) : null,
    embedText(query),
  ]);

  // Step 2: Embed expanded queries
  const variantEmbeddings = expansion && expansion.variants.length > 0
    ? await embedTexts(expansion.variants)
    : [];

  // Step 3: Parallel retrieval — original vector + keyword + expanded vectors
  const searchOpts = { limit: fetchLimit, minSimilarity, maxPerVideo: maxPerVideo + 1 };
  const keywords = expansion?.keywords ?? [];

  const retrievalTasks: Array<Promise<ReadonlyArray<FusionCandidate>>> = [
    // Original semantic search
    vectorSearchEnriched(channelId, originalEmbedding, searchOpts)
      .then((chunks) => chunks.map((c) => vectorToCandidate(c, "semantic"))),
    // Keyword search
    keywords.length > 0
      ? keywordSearch(channelId, keywords, fetchLimit)
          .then((hits) => hits.map(keywordToCandidate))
      : Promise.resolve([]),
  ];

  // Expanded query vector searches
  for (const variantEmb of variantEmbeddings) {
    retrievalTasks.push(
      vectorSearchEnriched(channelId, variantEmb, searchOpts)
        .then((chunks) => chunks.map((c) => vectorToCandidate(c, "expanded_query"))),
    );
  }

  const rankedLists = await Promise.all(retrievalTasks);

  // Step 4: RRF Fusion + MMR Reranking
  const reranked = rerank(rankedLists, limit, maxPerVideo);

  // Step 5: Context expansion
  const enriched = includeContext && reranked.length > 0
    ? await expandContext(reranked)
    : reranked.map((r) => ({ result: r, expanded: null }));

  // Build metrics
  const metrics: PipelineMetrics = {
    totalCandidates: rankedLists.reduce((sum, l) => sum + l.length, 0),
    vectorHits: rankedLists.at(0)?.length ?? 0,
    keywordHits: rankedLists.at(1)?.length ?? 0,
    expandedHits: rankedLists.slice(2).reduce((sum, l) => sum + l.length, 0),
    queryExpansion: expansion,
    durationMs: Math.round(performance.now() - start),
  };

  log.info("pipeline complete", {
    results: reranked.length,
    candidates: metrics.totalCandidates,
    ms: metrics.durationMs,
  });

  done();

  return {
    results: enriched.map(({ result, expanded }) => ({
      content: result.content,
      expandedContent: expanded,
      videoId: result.videoId,
      videoTitle: result.videoTitle,
      videoUrl: result.videoUrl,
      similarity: result.similarity,
      score: result.score,
      confidence: result.confidence,
      sources: result.sources,
      startSec: result.startSec,
    })),
    metrics,
  };
}

// ─── Multi-Channel Pipeline ────────────────────────────────────────

export async function searchMultiChannel(
  channelIds: ReadonlyArray<string>,
  query: string,
  opts: PipelineOptions = {},
): Promise<PipelineResponse<MultiPipelineResult>> {
  const start = performance.now();
  const limit = opts.limit ?? DEFAULT_RESULT_LIMIT;
  const minSimilarity = opts.minSimilarity ?? MIN_SIMILARITY;
  const maxPerVideo = opts.maxPerVideo ?? MAX_PER_VIDEO;
  const shouldExpand = opts.expandQueries ?? true;
  const includeContext = opts.includeContext ?? true;
  const fetchLimit = limit * RETRIEVAL_MULTIPLIER;

  const done = log.time(`pipeline multi channels=${channelIds.length}`);

  // Step 1: Query expansion + original embedding
  const [expansion, originalEmbedding] = await Promise.all([
    shouldExpand ? expandQuery(query) : null,
    embedText(query),
  ]);

  // Step 2: Embed expanded queries
  const variantEmbeddings = expansion && expansion.variants.length > 0
    ? await embedTexts(expansion.variants)
    : [];

  // Step 3: Parallel multi-channel retrieval
  const searchOpts = { limit: fetchLimit, minSimilarity, maxPerVideo: maxPerVideo + 1 };
  const keywords = expansion?.keywords ?? [];

  const retrievalTasks: Array<Promise<ReadonlyArray<FusionCandidate>>> = [
    vectorSearchEnrichedMulti(channelIds, originalEmbedding, searchOpts)
      .then((chunks) => chunks.map((c) => multiVectorToCandidate(c, "semantic"))),
    keywords.length > 0
      ? keywordSearchMulti(channelIds, keywords, fetchLimit)
          .then((hits) => hits.map(multiKeywordToCandidate))
      : Promise.resolve([]),
  ];

  for (const variantEmb of variantEmbeddings) {
    retrievalTasks.push(
      vectorSearchEnrichedMulti(channelIds, variantEmb, searchOpts)
        .then((chunks) => chunks.map((c) => multiVectorToCandidate(c, "expanded_query"))),
    );
  }

  const rankedLists = await Promise.all(retrievalTasks);

  // Step 4: Rerank
  const reranked = rerank(rankedLists, limit, maxPerVideo);

  // Step 5: Context expansion
  const enriched = includeContext && reranked.length > 0
    ? await expandContext(reranked)
    : reranked.map((r) => ({ result: r, expanded: null }));

  const metrics: PipelineMetrics = {
    totalCandidates: rankedLists.reduce((sum, l) => sum + l.length, 0),
    vectorHits: rankedLists.at(0)?.length ?? 0,
    keywordHits: rankedLists.at(1)?.length ?? 0,
    expandedHits: rankedLists.slice(2).reduce((sum, l) => sum + l.length, 0),
    queryExpansion: expansion,
    durationMs: Math.round(performance.now() - start),
  };

  log.info("multi pipeline complete", {
    results: reranked.length,
    candidates: metrics.totalCandidates,
    channels: channelIds.length,
    ms: metrics.durationMs,
  });

  done();

  return {
    results: enriched.map(({ result, expanded }) => ({
      content: result.content,
      expandedContent: expanded,
      videoId: result.videoId,
      videoTitle: result.videoTitle,
      videoUrl: result.videoUrl,
      similarity: result.similarity,
      score: result.score,
      confidence: result.confidence,
      sources: result.sources,
      startSec: result.startSec,
      channelId: result.channelId ?? "",
      channelName: result.channelName ?? "",
    })),
    metrics,
  };
}
