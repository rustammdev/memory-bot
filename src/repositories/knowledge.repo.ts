import { db } from "../db/connection";

export const NODE_TYPES = [
  "concept", "tool", "framework", "method", "person", "pattern", "language", "library", "platform",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  "requires", "part_of", "related_to", "alternative_to", "extends", "used_with", "implements",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface KnowledgeNodeRow {
  readonly id: string;
  readonly channel_id: string;
  readonly label: string;
  readonly normalized_label: string;
  readonly type: NodeType;
  readonly description: string | null;
  readonly importance: number;
  readonly mention_count: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface KnowledgeEdgeRow {
  readonly id: string;
  readonly channel_id: string;
  readonly source_id: string;
  readonly target_id: string;
  readonly relationship: RelationshipType;
  readonly weight: number;
  readonly context: string | null;
  readonly created_at: Date;
}

export interface NodeVideoRefRow {
  readonly id: string;
  readonly node_id: string;
  readonly video_id: string;
  readonly chunk_id: string | null;
  readonly context: string | null;
  readonly relevance: number;
  readonly created_at: Date;
}

export interface NodeUpsert {
  readonly channelId: string;
  readonly label: string;
  readonly type: NodeType;
  readonly description: string | null;
}

export interface EdgeUpsert {
  readonly channelId: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly relationship: RelationshipType;
  readonly context: string | null;
}

export interface VideoRefInsert {
  readonly nodeId: string;
  readonly videoId: string;
  readonly chunkId: string | null;
  readonly context: string | null;
  readonly relevance: number;
}

export function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function upsertNode(data: NodeUpsert): Promise<KnowledgeNodeRow> {
  const normalized = normalizeLabel(data.label);
  const rows = await db`
    INSERT INTO knowledge_nodes (channel_id, label, normalized_label, type, description, mention_count)
    VALUES (${data.channelId}, ${data.label}, ${normalized}, ${data.type}, ${data.description}, 1)
    ON CONFLICT (channel_id, normalized_label) DO UPDATE SET
      mention_count = knowledge_nodes.mention_count + 1,
      description = COALESCE(NULLIF(EXCLUDED.description, ''), knowledge_nodes.description),
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0] as KnowledgeNodeRow;
}

export async function upsertNodes(
  channelId: string,
  nodes: ReadonlyArray<{ label: string; type: NodeType; description: string | null }>,
): Promise<ReadonlyArray<KnowledgeNodeRow>> {
  if (nodes.length === 0) return [];

  const results: KnowledgeNodeRow[] = [];
  for (const node of nodes) {
    const row = await upsertNode({
      channelId,
      label: node.label,
      type: node.type,
      description: node.description,
    });
    results.push(row);
  }
  return results;
}

export async function upsertEdge(data: EdgeUpsert): Promise<KnowledgeEdgeRow | null> {
  const sourceNorm = normalizeLabel(data.sourceLabel);
  const targetNorm = normalizeLabel(data.targetLabel);

  const rows = await db`
    WITH src AS (
      SELECT id FROM knowledge_nodes
      WHERE channel_id = ${data.channelId} AND normalized_label = ${sourceNorm}
    ),
    tgt AS (
      SELECT id FROM knowledge_nodes
      WHERE channel_id = ${data.channelId} AND normalized_label = ${targetNorm}
    )
    INSERT INTO knowledge_edges (channel_id, source_id, target_id, relationship, context)
    SELECT ${data.channelId}, src.id, tgt.id, ${data.relationship}, ${data.context}
    FROM src, tgt
    WHERE src.id IS NOT NULL AND tgt.id IS NOT NULL
    ON CONFLICT (source_id, target_id, relationship) DO UPDATE SET
      weight = knowledge_edges.weight + 1,
      context = COALESCE(NULLIF(EXCLUDED.context, ''), knowledge_edges.context)
    RETURNING *
  `;
  return (rows[0] as KnowledgeEdgeRow) ?? null;
}

export async function addVideoRef(data: VideoRefInsert): Promise<void> {
  await db`
    INSERT INTO node_video_references (node_id, video_id, chunk_id, context, relevance)
    VALUES (${data.nodeId}, ${data.videoId}, ${data.chunkId}, ${data.context}, ${data.relevance})
    ON CONFLICT (node_id, video_id, chunk_id) DO NOTHING
  `;
}

export async function findNodesByChannel(
  channelId: string,
): Promise<ReadonlyArray<KnowledgeNodeRow>> {
  return db`
    SELECT * FROM knowledge_nodes
    WHERE channel_id = ${channelId}
    ORDER BY importance DESC, mention_count DESC
  ` as Promise<ReadonlyArray<KnowledgeNodeRow>>;
}

export async function findEdgesByChannel(
  channelId: string,
): Promise<ReadonlyArray<KnowledgeEdgeRow>> {
  return db`
    SELECT * FROM knowledge_edges
    WHERE channel_id = ${channelId}
    ORDER BY weight DESC
  ` as Promise<ReadonlyArray<KnowledgeEdgeRow>>;
}

export async function findTopNodes(
  channelId: string,
  limit: number,
): Promise<ReadonlyArray<KnowledgeNodeRow>> {
  return db`
    SELECT * FROM knowledge_nodes
    WHERE channel_id = ${channelId}
    ORDER BY importance DESC, mention_count DESC
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<KnowledgeNodeRow>>;
}

export async function findNodeById(
  nodeId: string,
): Promise<KnowledgeNodeRow | null> {
  const rows = await db`SELECT * FROM knowledge_nodes WHERE id = ${nodeId}`;
  return (rows[0] as KnowledgeNodeRow) ?? null;
}

export async function findNodeByLabel(
  channelId: string,
  label: string,
): Promise<KnowledgeNodeRow | null> {
  const normalized = normalizeLabel(label);
  const rows = await db`
    SELECT * FROM knowledge_nodes
    WHERE channel_id = ${channelId} AND normalized_label = ${normalized}
  `;
  return (rows[0] as KnowledgeNodeRow) ?? null;
}

export async function findVideoRefsForNode(
  nodeId: string,
): Promise<ReadonlyArray<NodeVideoRefRow & { video_title: string; youtube_video_id: string }>> {
  return db`
    SELECT nvr.*, v.title AS video_title, v.youtube_video_id
    FROM node_video_references nvr
    JOIN videos v ON v.id = nvr.video_id
    WHERE nvr.node_id = ${nodeId}
    ORDER BY nvr.relevance DESC
  ` as Promise<ReadonlyArray<NodeVideoRefRow & { video_title: string; youtube_video_id: string }>>;
}

export async function findNeighbors(
  nodeId: string,
): Promise<ReadonlyArray<KnowledgeEdgeRow & { neighbor_label: string; neighbor_type: NodeType }>> {
  return db`
    SELECT e.*,
      CASE WHEN e.source_id = ${nodeId} THEN tn.label ELSE sn.label END AS neighbor_label,
      CASE WHEN e.source_id = ${nodeId} THEN tn.type ELSE sn.type END AS neighbor_type
    FROM knowledge_edges e
    JOIN knowledge_nodes sn ON sn.id = e.source_id
    JOIN knowledge_nodes tn ON tn.id = e.target_id
    WHERE e.source_id = ${nodeId} OR e.target_id = ${nodeId}
    ORDER BY e.weight DESC
  ` as Promise<ReadonlyArray<KnowledgeEdgeRow & { neighbor_label: string; neighbor_type: NodeType }>>;
}

export async function updateImportance(channelId: string): Promise<void> {
  await db`
    WITH degree AS (
      SELECT n.id,
        COUNT(DISTINCT e.id) AS edge_count,
        n.mention_count
      FROM knowledge_nodes n
      LEFT JOIN knowledge_edges e ON e.source_id = n.id OR e.target_id = n.id
      WHERE n.channel_id = ${channelId}
      GROUP BY n.id, n.mention_count
    )
    UPDATE knowledge_nodes
    SET importance = (d.mention_count * 0.4 + d.edge_count * 0.6)::REAL,
        updated_at = NOW()
    FROM degree d
    WHERE knowledge_nodes.id = d.id
      AND knowledge_nodes.channel_id = ${channelId}
  `;
}

export interface GraphStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly topTypes: ReadonlyArray<{ readonly type: string; readonly count: number }>;
}

export async function getGraphStats(channelId: string): Promise<GraphStats> {
  const [nodeResult, edgeResult, typeResult] = await Promise.all([
    db`SELECT COUNT(*)::int AS count FROM knowledge_nodes WHERE channel_id = ${channelId}`,
    db`SELECT COUNT(*)::int AS count FROM knowledge_edges WHERE channel_id = ${channelId}`,
    db`
      SELECT type, COUNT(*)::int AS count
      FROM knowledge_nodes WHERE channel_id = ${channelId}
      GROUP BY type ORDER BY count DESC
    `,
  ]);

  return {
    nodeCount: (nodeResult[0] as { count: number }).count,
    edgeCount: (edgeResult[0] as { count: number }).count,
    topTypes: typeResult as ReadonlyArray<{ type: string; count: number }>,
  };
}

export interface ChunkWithVideo {
  readonly id: string;
  readonly video_id: string;
  readonly content: string;
  readonly video_title: string;
  readonly youtube_video_id: string;
}

export async function findChunksWithVideos(
  channelId: string,
): Promise<ReadonlyArray<ChunkWithVideo>> {
  return db`
    SELECT ce.id, ce.video_id, ce.content, v.title AS video_title, v.youtube_video_id
    FROM chunk_embeddings ce
    JOIN videos v ON v.id = ce.video_id
    WHERE ce.channel_id = ${channelId}
    ORDER BY v.uploaded_at DESC NULLS LAST, ce.chunk_index ASC
  ` as Promise<ReadonlyArray<ChunkWithVideo>>;
}

export async function deleteChannelGraph(channelId: string): Promise<void> {
  await db`DELETE FROM knowledge_nodes WHERE channel_id = ${channelId}`;
}

export async function nodeCount(channelId: string): Promise<number> {
  const rows = await db`
    SELECT COUNT(*)::int AS count FROM knowledge_nodes WHERE channel_id = ${channelId}
  `;
  return (rows[0] as { count: number }).count;
}
