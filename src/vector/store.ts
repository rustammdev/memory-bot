import { db } from "../db/connection";

export interface ChunkRecord {
  readonly channelId: string;
  readonly videoId: string;
  readonly transcriptId: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly embedding: number[];
  readonly importance: number;
  readonly startSec: number | null;
}

export interface SearchResult {
  readonly content: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly similarity: number;
}

export interface EnrichedChunk {
  readonly content: string;
  readonly videoId: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly transcriptId: string;
  readonly chunkIndex: number;
  readonly similarity: number;
  readonly importance: number;
  readonly videoViewCount: number;
  readonly startSec: number | null;
}

export interface MultiEnrichedChunk extends EnrichedChunk {
  readonly channelId: string;
  readonly channelName: string;
}

export interface KeywordHit {
  readonly content: string;
  readonly videoId: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly transcriptId: string;
  readonly chunkIndex: number;
  readonly importance: number;
  readonly videoViewCount: number;
  readonly startSec: number | null;
  readonly rank: number;
}

export interface MultiKeywordHit extends KeywordHit {
  readonly channelId: string;
  readonly channelName: string;
}

export interface AdjacentChunk {
  readonly chunkIndex: number;
  readonly content: string;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function str(v: unknown, field: string): string {
  if (typeof v === "string") return v;
  throw new TypeError(`DB row: expected string for "${field}", got ${v === null ? "null" : typeof v}`);
}

function num(v: unknown, field: string): number {
  if (typeof v === "number") return v;
  throw new TypeError(`DB row: expected number for "${field}", got ${v === null ? "null" : typeof v}`);
}

// ─── Write Operations ──────────────────────────────────────────────

export async function insertChunks(
  chunks: ReadonlyArray<ChunkRecord>,
  transcriptId?: string,
): Promise<void> {
  if (chunks.length === 0) return;

  await db.begin(async (tx) => {
    for (const c of chunks) {
      const vectorStr = toVectorLiteral(c.embedding);
      await tx`
        INSERT INTO chunk_embeddings (
          channel_id, video_id, transcript_id,
          chunk_index, content, embedding, importance, start_sec
        )
        VALUES (
          ${c.channelId}, ${c.videoId}, ${c.transcriptId},
          ${c.chunkIndex}, ${c.content}, ${vectorStr}::vector, ${c.importance}, ${c.startSec}
        )
        ON CONFLICT (transcript_id, chunk_index) DO UPDATE SET
          content   = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          importance = EXCLUDED.importance,
          start_sec = EXCLUDED.start_sec
      `;
    }

    if (transcriptId) {
      await tx`UPDATE transcripts SET vectorized = TRUE WHERE id = ${transcriptId}`;
    }
  });
}

export async function deleteByTranscript(
  transcriptId: string,
): Promise<void> {
  await db`DELETE FROM chunk_embeddings WHERE transcript_id = ${transcriptId}`;
}

// ─── Legacy Search (backward-compatible) ───────────────────────────

export async function searchByChannel(
  channelId: string,
  queryEmbedding: number[],
  limit = 5,
): Promise<ReadonlyArray<SearchResult>> {
  const vectorStr = toVectorLiteral(queryEmbedding);
  const rows = await db`
    WITH ranked AS (
      SELECT
        ce.content,
        v.title AS video_title,
        v.url AS video_url,
        ce.embedding <=> ${vectorStr}::vector AS distance
      FROM chunk_embeddings ce
      JOIN videos v ON v.id = ce.video_id
      WHERE ce.channel_id = ${channelId}
    )
    SELECT content, video_title, video_url, 1 - distance AS similarity
    FROM ranked
    ORDER BY distance
    LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    content: str(r.content, "content"),
    videoTitle: str(r.video_title, "video_title"),
    videoUrl: str(r.video_url, "video_url"),
    similarity: num(r.similarity, "similarity"),
  }));
}

export interface MultiSearchResult extends SearchResult {
  readonly channelId: string;
  readonly channelName: string;
}

export async function searchByChannels(
  channelIds: ReadonlyArray<string>,
  queryEmbedding: number[],
  limit = 5,
): Promise<ReadonlyArray<MultiSearchResult>> {
  if (channelIds.length === 0) return [];
  const vectorStr = toVectorLiteral(queryEmbedding);
  const ids = Array.from(channelIds);
  const rows = await db`
    WITH ranked AS (
      SELECT
        ce.content,
        ce.channel_id,
        ch.name AS channel_name,
        v.title AS video_title,
        v.url AS video_url,
        ce.embedding <=> ${vectorStr}::vector AS distance
      FROM chunk_embeddings ce
      JOIN videos v ON v.id = ce.video_id
      JOIN channels ch ON ch.id = ce.channel_id
      WHERE ce.channel_id = ANY(${ids})
    )
    SELECT content, channel_id, channel_name, video_title, video_url,
           1 - distance AS similarity
    FROM ranked
    ORDER BY distance
    LIMIT ${limit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    content: str(r.content, "content"),
    channelId: str(r.channel_id, "channel_id"),
    channelName: str(r.channel_name, "channel_name"),
    videoTitle: str(r.video_title, "video_title"),
    videoUrl: str(r.video_url, "video_url"),
    similarity: num(r.similarity, "similarity"),
  }));
}

// ─── Enhanced Vector Search ────────────────────────────────────────
// Similarity threshold, per-video dedup, importance-weighted scoring

export interface EnrichedSearchOptions {
  readonly limit?: number;
  readonly minSimilarity?: number;
  readonly maxPerVideo?: number;
}

const DEFAULT_MIN_SIMILARITY = 0.35;
const DEFAULT_MAX_PER_VIDEO = 2;

export async function vectorSearchEnriched(
  channelId: string,
  queryEmbedding: number[],
  opts: EnrichedSearchOptions = {},
): Promise<ReadonlyArray<EnrichedChunk>> {
  const limit = opts.limit ?? 10;
  const minSim = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
  const maxPerVideo = opts.maxPerVideo ?? DEFAULT_MAX_PER_VIDEO;
  const vectorStr = toVectorLiteral(queryEmbedding);

  const rows = await db`
    WITH scored AS (
      SELECT
        ce.content,
        ce.video_id,
        ce.transcript_id,
        ce.chunk_index,
        ce.importance,
        ce.start_sec,
        v.title AS video_title,
        v.url AS video_url,
        v.view_count AS video_view_count,
        1 - (ce.embedding <=> ${vectorStr}::vector) AS similarity,
        ROW_NUMBER() OVER (
          PARTITION BY ce.video_id
          ORDER BY ce.embedding <=> ${vectorStr}::vector
        ) AS rn
      FROM chunk_embeddings ce
      JOIN videos v ON v.id = ce.video_id
      WHERE ce.channel_id = ${channelId}
    )
    SELECT *
    FROM scored
    WHERE similarity >= ${minSim} AND rn <= ${maxPerVideo}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    content: str(r.content, "content"),
    videoId: str(r.video_id, "video_id"),
    videoTitle: str(r.video_title, "video_title"),
    videoUrl: str(r.video_url, "video_url"),
    transcriptId: str(r.transcript_id, "transcript_id"),
    chunkIndex: num(r.chunk_index, "chunk_index"),
    similarity: num(r.similarity, "similarity"),
    importance: num(r.importance, "importance"),
    videoViewCount: num(r.video_view_count, "video_view_count"),
    startSec: r.start_sec as number | null,
  }));
}

export async function vectorSearchEnrichedMulti(
  channelIds: ReadonlyArray<string>,
  queryEmbedding: number[],
  opts: EnrichedSearchOptions = {},
): Promise<ReadonlyArray<MultiEnrichedChunk>> {
  if (channelIds.length === 0) return [];
  const limit = opts.limit ?? 15;
  const minSim = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
  const maxPerVideo = opts.maxPerVideo ?? DEFAULT_MAX_PER_VIDEO;
  const vectorStr = toVectorLiteral(queryEmbedding);
  const ids = Array.from(channelIds);

  const rows = await db`
    WITH scored AS (
      SELECT
        ce.content,
        ce.video_id,
        ce.channel_id,
        ch.name AS channel_name,
        ce.transcript_id,
        ce.chunk_index,
        ce.importance,
        ce.start_sec,
        v.title AS video_title,
        v.url AS video_url,
        v.view_count AS video_view_count,
        1 - (ce.embedding <=> ${vectorStr}::vector) AS similarity,
        ROW_NUMBER() OVER (
          PARTITION BY ce.video_id
          ORDER BY ce.embedding <=> ${vectorStr}::vector
        ) AS rn
      FROM chunk_embeddings ce
      JOIN videos v ON v.id = ce.video_id
      JOIN channels ch ON ch.id = ce.channel_id
      WHERE ce.channel_id = ANY(${ids})
    )
    SELECT *
    FROM scored
    WHERE similarity >= ${minSim} AND rn <= ${maxPerVideo}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    content: str(r.content, "content"),
    videoId: str(r.video_id, "video_id"),
    channelId: str(r.channel_id, "channel_id"),
    channelName: str(r.channel_name, "channel_name"),
    videoTitle: str(r.video_title, "video_title"),
    videoUrl: str(r.video_url, "video_url"),
    transcriptId: str(r.transcript_id, "transcript_id"),
    chunkIndex: num(r.chunk_index, "chunk_index"),
    similarity: num(r.similarity, "similarity"),
    importance: num(r.importance, "importance"),
    videoViewCount: num(r.video_view_count, "video_view_count"),
    startSec: r.start_sec as number | null,
  }));
}

// ─── Full-Text Keyword Search ──────────────────────────────────────

export async function keywordSearch(
  channelId: string,
  keywords: ReadonlyArray<string>,
  limit = 10,
): Promise<ReadonlyArray<KeywordHit>> {
  if (keywords.length === 0) return [];
  const tsQuery = keywords.map((k) => k.replace(/[^\w\s'-]/g, "")).join(" | ");

  const rows = await db`
    SELECT
      ce.content,
      ce.video_id,
      ce.transcript_id,
      ce.chunk_index,
      ce.importance,
      ce.start_sec,
      v.title AS video_title,
      v.url AS video_url,
      v.view_count AS video_view_count,
      ts_rank_cd(ce.tsv, to_tsquery('english', ${tsQuery})) AS rank
    FROM chunk_embeddings ce
    JOIN videos v ON v.id = ce.video_id
    WHERE ce.channel_id = ${channelId}
      AND ce.tsv @@ to_tsquery('english', ${tsQuery})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    content: str(r.content, "content"),
    videoId: str(r.video_id, "video_id"),
    videoTitle: str(r.video_title, "video_title"),
    videoUrl: str(r.video_url, "video_url"),
    transcriptId: str(r.transcript_id, "transcript_id"),
    chunkIndex: num(r.chunk_index, "chunk_index"),
    importance: num(r.importance, "importance"),
    videoViewCount: num(r.video_view_count, "video_view_count"),
    startSec: r.start_sec as number | null,
    rank: num(r.rank, "rank"),
  }));
}

export async function keywordSearchMulti(
  channelIds: ReadonlyArray<string>,
  keywords: ReadonlyArray<string>,
  limit = 15,
): Promise<ReadonlyArray<MultiKeywordHit>> {
  if (channelIds.length === 0 || keywords.length === 0) return [];
  const tsQuery = keywords.map((k) => k.replace(/[^\w\s'-]/g, "")).join(" | ");
  const ids = Array.from(channelIds);

  const rows = await db`
    SELECT
      ce.content,
      ce.video_id,
      ce.channel_id,
      ch.name AS channel_name,
      ce.transcript_id,
      ce.chunk_index,
      ce.importance,
      ce.start_sec,
      v.title AS video_title,
      v.url AS video_url,
      v.view_count AS video_view_count,
      ts_rank_cd(ce.tsv, to_tsquery('english', ${tsQuery})) AS rank
    FROM chunk_embeddings ce
    JOIN videos v ON v.id = ce.video_id
    JOIN channels ch ON ch.id = ce.channel_id
    WHERE ce.channel_id = ANY(${ids})
      AND ce.tsv @@ to_tsquery('english', ${tsQuery})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    content: str(r.content, "content"),
    videoId: str(r.video_id, "video_id"),
    channelId: str(r.channel_id, "channel_id"),
    channelName: str(r.channel_name, "channel_name"),
    videoTitle: str(r.video_title, "video_title"),
    videoUrl: str(r.video_url, "video_url"),
    transcriptId: str(r.transcript_id, "transcript_id"),
    chunkIndex: num(r.chunk_index, "chunk_index"),
    importance: num(r.importance, "importance"),
    videoViewCount: num(r.video_view_count, "video_view_count"),
    startSec: r.start_sec as number | null,
    rank: num(r.rank, "rank"),
  }));
}

// ─── Context Window Expansion ──────────────────────────────────────
// Fetch adjacent chunks to expand a matched chunk's context

export async function fetchAdjacentChunks(
  transcriptId: string,
  chunkIndex: number,
  windowSize = 1,
): Promise<ReadonlyArray<AdjacentChunk>> {
  const minIdx = Math.max(0, chunkIndex - windowSize);
  const maxIdx = chunkIndex + windowSize;

  const rows = await db`
    SELECT chunk_index, content
    FROM chunk_embeddings
    WHERE transcript_id = ${transcriptId}
      AND chunk_index >= ${minIdx}
      AND chunk_index <= ${maxIdx}
      AND chunk_index != ${chunkIndex}
    ORDER BY chunk_index
  `;

  return rows.map((r: Record<string, unknown>) => ({
    chunkIndex: num(r.chunk_index, "chunk_index"),
    content: str(r.content, "content"),
  }));
}
