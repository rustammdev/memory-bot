import { db } from "../db/connection";

export interface ChunkRecord {
  readonly channelId: string;
  readonly videoId: string;
  readonly transcriptId: string;
  readonly chunkIndex: number;
  readonly content: string;
  readonly embedding: number[];
  readonly importance: number;
}

export interface SearchResult {
  readonly content: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly similarity: number;
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
          chunk_index, content, embedding, importance
        )
        VALUES (
          ${c.channelId}, ${c.videoId}, ${c.transcriptId},
          ${c.chunkIndex}, ${c.content}, ${vectorStr}::vector, ${c.importance}
        )
        ON CONFLICT (transcript_id, chunk_index) DO UPDATE SET
          content   = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          importance = EXCLUDED.importance
      `;
    }

    if (transcriptId) {
      await tx`UPDATE transcripts SET vectorized = TRUE WHERE id = ${transcriptId}`;
    }
  });
}

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

export async function deleteByTranscript(
  transcriptId: string,
): Promise<void> {
  await db`DELETE FROM chunk_embeddings WHERE transcript_id = ${transcriptId}`;
}
