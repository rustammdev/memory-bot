/**
 * Reranker — Reciprocal Rank Fusion + MMR Diversity + Confidence Classification
 *
 * Combines results from multiple retrieval strategies (vector, keyword, expanded queries)
 * into a single ranked list using RRF, then enforces diversity via MMR.
 */

export type Confidence = "high" | "medium" | "low";
export type MatchSource = "semantic" | "keyword" | "expanded_query";

export interface FusionCandidate {
  readonly id: string;
  readonly content: string;
  readonly videoId: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly transcriptId: string;
  readonly chunkIndex: number;
  readonly similarity: number;
  readonly importance: number;
  readonly videoViewCount: number;
  readonly source: MatchSource;
  readonly channelId?: string;
  readonly channelName?: string;
}

export interface RankedResult {
  readonly content: string;
  readonly videoId: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly transcriptId: string;
  readonly chunkIndex: number;
  readonly similarity: number;
  readonly score: number;
  readonly confidence: Confidence;
  readonly sources: ReadonlyArray<MatchSource>;
  readonly channelId?: string;
  readonly channelName?: string;
}

// ─── Reciprocal Rank Fusion ────────────────────────────────────────
// Merges ranked lists from different strategies into a unified score
// Reference: Cormack, Clarke & Buettcher (2009)

const RRF_K = 60; // smoothing constant

interface RRFAccumulator {
  candidate: FusionCandidate;
  rrfScore: number;
  sources: Set<MatchSource>;
  bestSimilarity: number;
}

export function reciprocalRankFusion(
  rankedLists: ReadonlyArray<ReadonlyArray<FusionCandidate>>,
): ReadonlyArray<RRFAccumulator> {
  const accumulators = new Map<string, RRFAccumulator>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const candidate = list[rank]!;
      const existing = accumulators.get(candidate.id);

      const rrfContribution = 1 / (RRF_K + rank + 1);

      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.sources.add(candidate.source);
        existing.bestSimilarity = Math.max(existing.bestSimilarity, candidate.similarity);
      } else {
        accumulators.set(candidate.id, {
          candidate,
          rrfScore: rrfContribution,
          sources: new Set([candidate.source]),
          bestSimilarity: candidate.similarity,
        });
      }
    }
  }

  return Array.from(accumulators.values())
    .sort((a, b) => b.rrfScore - a.rrfScore);
}

// ─── Composite Scoring ─────────────────────────────────────────────
// Blends RRF score with importance (view count) and multi-source bonus

const WEIGHTS = {
  rrf: 0.55,
  similarity: 0.25,
  importance: 0.10,
  multiSourceBonus: 0.10,
} as const;

function normalizeViewCount(viewCount: number, maxViewCount: number): number {
  if (maxViewCount <= 0) return 0;
  return Math.min(viewCount / maxViewCount, 1);
}

export function computeCompositeScores(
  accumulators: ReadonlyArray<RRFAccumulator>,
): ReadonlyArray<{ accumulator: RRFAccumulator; compositeScore: number }> {
  if (accumulators.length === 0) return [];

  const maxRRF = accumulators[0]!.rrfScore;
  const maxViews = Math.max(...accumulators.map((a) => a.candidate.videoViewCount));

  return accumulators.map((acc) => {
    const normalizedRRF = maxRRF > 0 ? acc.rrfScore / maxRRF : 0;
    const normalizedImportance = normalizeViewCount(acc.candidate.videoViewCount, maxViews);
    const multiSourceBonus = acc.sources.size > 1 ? 1 : 0;

    const compositeScore =
      WEIGHTS.rrf * normalizedRRF +
      WEIGHTS.similarity * acc.bestSimilarity +
      WEIGHTS.importance * normalizedImportance +
      WEIGHTS.multiSourceBonus * multiSourceBonus;

    return { accumulator: acc, compositeScore };
  }).sort((a, b) => b.compositeScore - a.compositeScore);
}

// ─── Maximal Marginal Relevance (MMR) ──────────────────────────────
// Enforces diversity — penalizes results too similar to already-selected ones

const MMR_LAMBDA = 0.7; // 0 = full diversity, 1 = full relevance

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function mmrDiversify(
  scored: ReadonlyArray<{ accumulator: RRFAccumulator; compositeScore: number }>,
  limit: number,
  maxPerVideo = 2,
): ReadonlyArray<RankedResult> {
  if (scored.length === 0) return [];

  const selected: RankedResult[] = [];
  const remaining = [...scored];
  const videoCounts = new Map<string, number>();

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]!;
      const videoId = item.accumulator.candidate.videoId;

      // Skip if this video already has maxPerVideo results
      if ((videoCounts.get(videoId) ?? 0) >= maxPerVideo) continue;

      const relevance = item.compositeScore;

      // Max similarity to already selected results
      let maxSim = 0;
      for (const sel of selected) {
        const sim = jaccardSimilarity(item.accumulator.candidate.content, sel.content);
        if (sim > maxSim) maxSim = sim;
      }

      const mmrScore = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSim;

      if (mmrScore > bestMMR) {
        bestMMR = mmrScore;
        bestIdx = i;
      }
    }

    const chosen = remaining[bestIdx]!;
    const candidate = chosen.accumulator.candidate;
    const videoId = candidate.videoId;

    // Double-check video limit
    if ((videoCounts.get(videoId) ?? 0) >= maxPerVideo) {
      remaining.splice(bestIdx, 1);
      continue;
    }

    videoCounts.set(videoId, (videoCounts.get(videoId) ?? 0) + 1);

    selected.push({
      content: candidate.content,
      videoId: candidate.videoId,
      videoTitle: candidate.videoTitle,
      videoUrl: candidate.videoUrl,
      transcriptId: candidate.transcriptId,
      chunkIndex: candidate.chunkIndex,
      similarity: chosen.accumulator.bestSimilarity,
      score: chosen.compositeScore,
      confidence: classifyConfidence(chosen.accumulator),
      sources: Array.from(chosen.accumulator.sources),
      channelId: candidate.channelId,
      channelName: candidate.channelName,
    });

    remaining.splice(bestIdx, 1);
  }

  return selected;
}

// ─── Confidence Classification ─────────────────────────────────────

function classifyConfidence(acc: RRFAccumulator): Confidence {
  const sim = acc.bestSimilarity;
  const multiSource = acc.sources.size > 1;

  // High: strong vector match OR multi-source confirmation
  if (sim >= 0.75 || (sim >= 0.60 && multiSource)) return "high";
  // Medium: decent match
  if (sim >= 0.50 || (sim >= 0.40 && multiSource)) return "medium";
  // Low: weak match
  return "low";
}

// ─── Full Rerank Pipeline ──────────────────────────────────────────

export function rerank(
  rankedLists: ReadonlyArray<ReadonlyArray<FusionCandidate>>,
  limit: number,
  maxPerVideo = 2,
): ReadonlyArray<RankedResult> {
  const fused = reciprocalRankFusion(rankedLists);
  const scored = computeCompositeScores(fused);
  return mmrDiversify(scored, limit, maxPerVideo);
}
