import { db } from "../db/connection";

export interface EmbeddingRecord {
  readonly id: string;
  readonly videoId: string;
  readonly embedding: number[];
  readonly videoTitle: string;
}

export interface ClusterAssignment {
  readonly clusterId: number;
  readonly records: ReadonlyArray<EmbeddingRecord>;
  readonly centroid: number[];
}

const MAX_CHUNKS = 3000;
const MAX_ITERATIONS = 50;

export async function fetchChannelEmbeddings(
  channelId: string,
): Promise<ReadonlyArray<EmbeddingRecord>> {
  const rows = await db`
    SELECT ce.id, ce.video_id, ce.embedding::text AS embedding_text, v.title AS video_title
    FROM chunk_embeddings ce
    JOIN videos v ON v.id = ce.video_id
    WHERE ce.channel_id = ${channelId}
    ORDER BY ce.created_at DESC
    LIMIT ${MAX_CHUNKS}
  `;

  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    videoId: r.video_id as string,
    embedding: parseVector(r.embedding_text as string),
    videoTitle: r.video_title as string,
  }));
}

export async function fetchChunkContents(
  chunkIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<{ id: string; content: string }>> {
  if (chunkIds.length === 0) return [];
  const ids = chunkIds as unknown as string[];
  const rows = await db`
    SELECT id, content FROM chunk_embeddings WHERE id = ANY(${ids})
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    content: r.content as string,
  }));
}

function parseVector(text: string): number[] {
  const trimmed = text.replace(/^\[|\]$/g, "");
  return trimmed.split(",").map(Number);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

function initCentroidsKMeansPP(
  records: ReadonlyArray<EmbeddingRecord>,
  k: number,
): number[][] {
  const centroids: number[][] = [];

  const firstIdx = Math.floor(Math.random() * records.length);
  centroids.push([...records[firstIdx]!.embedding]);

  for (let c = 1; c < k; c++) {
    const distances = records.map((r) => {
      const minDist = Math.min(
        ...centroids.map((cent) => cosineDistance(r.embedding, cent)),
      );
      return minDist * minDist;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let target = Math.random() * totalDist;
    let chosen = 0;
    for (let i = 0; i < distances.length; i++) {
      target -= distances[i]!;
      if (target <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push([...records[chosen]!.embedding]);
  }

  return centroids;
}

function computeCentroid(
  records: ReadonlyArray<EmbeddingRecord>,
  dims: number,
): number[] {
  const centroid = new Array<number>(dims).fill(0);
  for (const r of records) {
    for (let d = 0; d < dims; d++) {
      centroid[d]! += r.embedding[d]!;
    }
  }
  for (let d = 0; d < dims; d++) {
    centroid[d]! /= records.length;
  }
  return centroid;
}

export function clusterEmbeddings(
  records: ReadonlyArray<EmbeddingRecord>,
  k?: number,
): ReadonlyArray<ClusterAssignment> {
  if (records.length === 0) return [];

  const first = records[0]!;
  if (records.length < 5) {
    return [
      {
        clusterId: 0,
        records,
        centroid: computeCentroid(records, first.embedding.length),
      },
    ];
  }

  const effectiveK = k ?? Math.min(Math.ceil(records.length / 8), 25);
  const clampedK = Math.min(effectiveK, records.length);
  const dims = first.embedding.length;

  let centroids = initCentroidsKMeansPP(records, clampedK);
  const assignments = new Array<number>(records.length).fill(0);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;

    for (let i = 0; i < records.length; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dist = cosineDistance(records[i]!.embedding, centroids[c]!);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    const newCentroids: number[][] = [];
    for (let c = 0; c < centroids.length; c++) {
      const members = records.filter((_, i) => assignments[i] === c);
      if (members.length === 0) {
        newCentroids.push(centroids[c]!);
      } else {
        newCentroids.push(computeCentroid(members, dims));
      }
    }
    centroids = newCentroids;
  }

  const clusters = new Map<number, EmbeddingRecord[]>();
  for (let i = 0; i < records.length; i++) {
    const c = assignments[i]!;
    if (!clusters.has(c)) clusters.set(c, []);
    clusters.get(c)!.push(records[i]!);
  }

  const result: ClusterAssignment[] = [];
  let idx = 0;
  for (const [clusterIdx, members] of clusters) {
    result.push({
      clusterId: idx++,
      records: members,
      centroid: centroids[clusterIdx] ?? [],
    });
  }

  return result.sort((a, b) => b.records.length - a.records.length);
}
