import { createLogger } from "../lib/logger";
import { ValidationError } from "../lib/errors";
import { deduplicateByKey } from "../lib/collection";
import { requireChannel } from "./channel.helpers";
import * as knowledgeRepo from "../repositories/knowledge.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { extractKnowledge } from "../ai/extract-knowledge";

const log = createLogger("knowledge");

const MIN_CHUNKS = 5;
const CHUNKS_PER_BATCH = 4;
const MAX_VIDEOS_PER_BUILD = 50;

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly type: knowledgeRepo.NodeType;
  readonly description: string | null;
  readonly importance: number;
  readonly mentionCount: number;
}

export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly relationship: knowledgeRepo.RelationshipType;
  readonly weight: number;
  readonly context: string | null;
}

function toGraphNode(row: knowledgeRepo.KnowledgeNodeRow): GraphNode {
  return {
    id: row.id,
    label: row.label,
    type: row.type,
    description: row.description,
    importance: row.importance,
    mentionCount: row.mention_count,
  };
}

function toGraphEdge(row: knowledgeRepo.KnowledgeEdgeRow): GraphEdge {
  return {
    id: row.id,
    source: row.source_id,
    target: row.target_id,
    relationship: row.relationship,
    weight: row.weight,
    context: row.context,
  };
}

export interface ChannelGraph {
  readonly channelName: string;
  readonly handle: string;
  readonly category: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodes: ReadonlyArray<GraphNode>;
  readonly edges: ReadonlyArray<GraphEdge>;
}

export interface NodeVideoRef {
  readonly videoId: string;
  readonly youtubeVideoId: string;
  readonly title: string;
  readonly context: string | null;
  readonly relevance: number;
}

export interface NodeNeighbor {
  readonly nodeId: string;
  readonly label: string;
  readonly type: knowledgeRepo.NodeType;
  readonly relationship: knowledgeRepo.RelationshipType;
  readonly direction: "outgoing" | "incoming";
  readonly weight: number;
}

export interface NodeDetail extends GraphNode {
  readonly videos: ReadonlyArray<NodeVideoRef>;
  readonly neighbors: ReadonlyArray<NodeNeighbor>;
}

export interface LearningPath {
  readonly from: string;
  readonly to: string;
  readonly found: boolean;
  readonly path: ReadonlyArray<{
    readonly nodeId: string;
    readonly label: string;
    readonly type: knowledgeRepo.NodeType;
    readonly relationship: string | null;
  }>;
  readonly totalSteps: number;
}

export async function buildChannelGraph(
  channelInput: string | null,
  force = false,
): Promise<ChannelGraph> {
  const done = log.time(`buildGraph [${channelInput}]`);
  const channel = await requireChannel(channelInput);
  const metadata = await metadataRepo.findLatest(channel.id);
  const category = metadata?.category ?? "other";

  if (!force) {
    const existing = await knowledgeRepo.nodeCount(channel.id);
    if (existing > 0) {
      log.info("graph exists, returning cached", { nodes: existing });
      done();
      return getChannelGraph(channelInput);
    }
  }

  if (force) {
    await knowledgeRepo.deleteChannelGraph(channel.id);
  }

  const allChunks = await knowledgeRepo.findChunksWithVideos(channel.id);
  if (allChunks.length < MIN_CHUNKS) {
    throw new ValidationError(
      `Not enough transcripts. Need at least ${MIN_CHUNKS} chunks, have ${allChunks.length}. Fetch more transcripts first.`,
    );
  }

  const videoChunks = Map.groupBy(allChunks, (c) => c.video_id);

  const videoIds = [...videoChunks.keys()].slice(0, MAX_VIDEOS_PER_BUILD);
  log.info("processing videos", { total: videoIds.length, totalChunks: allChunks.length });

  const nodeMap = new Map<string, knowledgeRepo.KnowledgeNodeRow>();

  for (const videoId of videoIds) {
    const chunks = videoChunks.get(videoId) ?? [];
    const videoTitle = chunks[0]?.video_title ?? "Unknown";

    for (let i = 0; i < chunks.length; i += CHUNKS_PER_BATCH) {
      const batch = chunks.slice(i, i + CHUNKS_PER_BATCH);

      try {
        const result = await extractKnowledge(
          videoTitle,
          category,
          batch.map((c) => ({ content: c.content, chunkId: c.id })),
        );

        const upsertedNodes = await knowledgeRepo.upsertNodes(
          channel.id,
          result.entities.map((e) => ({
            label: e.label,
            type: e.type,
            description: e.description,
          })),
        );

        for (const node of upsertedNodes) {
          nodeMap.set(node.normalized_label, node);
        }

        await Promise.all(
          result.relationships.map((rel) =>
            knowledgeRepo.upsertEdge({
              channelId: channel.id,
              sourceLabel: rel.source,
              targetLabel: rel.target,
              relationship: rel.type,
              context: rel.context,
            }),
          ),
        );

        await linkEntityMentions(result.entities, batch, nodeMap, extractSnippet);
      } catch (err) {
        log.warn("extraction failed for batch, skipping", {
          videoTitle,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  await knowledgeRepo.updateImportance(channel.id);
  log.info("graph built successfully");
  done();

  return getChannelGraph(channelInput);
}

async function linkEntityMentions(
  entities: ReadonlyArray<{ label: string }>,
  batch: ReadonlyArray<knowledgeRepo.ChunkWithVideo>,
  nodeMap: Map<string, knowledgeRepo.KnowledgeNodeRow>,
  snippetFn: (content: string, term: string) => string,
): Promise<void> {
  const refs: knowledgeRepo.VideoRefInsert[] = [];

  for (const entity of entities) {
    const node = nodeMap.get(knowledgeRepo.normalizeLabel(entity.label));
    if (!node) continue;

    const lowerLabel = entity.label.toLowerCase();
    for (const chunk of batch) {
      if (chunk.content.toLowerCase().includes(lowerLabel)) {
        refs.push({
          nodeId: node.id,
          videoId: chunk.video_id,
          chunkId: chunk.id,
          context: snippetFn(chunk.content, entity.label),
          relevance: 1.0,
        });
      }
    }
  }

  await Promise.all(refs.map((ref) => knowledgeRepo.addVideoRef(ref)));
}

function extractSnippet(content: string, term: string): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return content.slice(0, 150);
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + term.length + 60);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end)}${suffix}`;
}

export async function getChannelGraph(
  channelInput: string | null,
): Promise<ChannelGraph> {
  const channel = await requireChannel(channelInput);
  const metadata = await metadataRepo.findLatest(channel.id);

  const [nodes, edges] = await Promise.all([
    knowledgeRepo.findNodesByChannel(channel.id),
    knowledgeRepo.findEdgesByChannel(channel.id),
  ]);

  return {
    channelName: channel.name,
    handle: channel.username,
    category: metadata?.category ?? "other",
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes: nodes.map(toGraphNode),
    edges: edges.map(toGraphEdge),
  };
}

export async function getNodeDetails(nodeId: string): Promise<NodeDetail | null> {
  const node = await knowledgeRepo.findNodeById(nodeId);
  if (!node) return null;

  const [refs, neighbors] = await Promise.all([
    knowledgeRepo.findVideoRefsForNode(nodeId),
    knowledgeRepo.findNeighbors(nodeId),
  ]);

  const uniqueRefs = deduplicateByKey(refs, (r) => r.video_id);

  return {
    ...toGraphNode(node),
    videos: uniqueRefs.map((r) => ({
      videoId: r.video_id,
      youtubeVideoId: r.youtube_video_id,
      title: r.video_title,
      context: r.context,
      relevance: r.relevance,
    })),
    neighbors: neighbors.map((n) => ({
      nodeId: n.source_id === nodeId ? n.target_id : n.source_id,
      label: n.neighbor_label,
      type: n.neighbor_type,
      relationship: n.relationship,
      direction: (n.source_id === nodeId ? "outgoing" : "incoming") as "outgoing" | "incoming",
      weight: n.weight,
    })),
  };
}

export async function findLearningPath(
  channelInput: string | null,
  fromLabel: string,
  toLabel: string,
): Promise<LearningPath> {
  const channel = await requireChannel(channelInput);
  return findLearningPathByChannelId(channel.id, fromLabel, toLabel);
}

export async function findLearningPathByChannelId(
  channelId: string,
  fromLabel: string,
  toLabel: string,
): Promise<LearningPath> {
  const [fromNode, toNode] = await Promise.all([
    knowledgeRepo.findNodeByLabel(channelId, fromLabel),
    knowledgeRepo.findNodeByLabel(channelId, toLabel),
  ]);

  const emptyPath: LearningPath = { from: fromLabel, to: toLabel, found: false, path: [], totalSteps: 0 };

  if (!fromNode || !toNode) return emptyPath;

  const [nodes, edges] = await Promise.all([
    knowledgeRepo.findNodesByChannel(channelId),
    knowledgeRepo.findEdgesByChannel(channelId),
  ]);

  const adjacency = new Map<string, Array<{ nodeId: string; edgeRelation: string }>>();
  for (const edge of edges) {
    const srcList = adjacency.get(edge.source_id) ?? [];
    srcList.push({ nodeId: edge.target_id, edgeRelation: edge.relationship });
    adjacency.set(edge.source_id, srcList);

    const tgtList = adjacency.get(edge.target_id) ?? [];
    tgtList.push({ nodeId: edge.source_id, edgeRelation: edge.relationship });
    adjacency.set(edge.target_id, tgtList);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const visited = new Set<string>();
  const parent = new Map<string, { nodeId: string; relationship: string }>();
  const queue: string[] = [fromNode.id];
  visited.add(fromNode.id);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === toNode.id) {
      const path: LearningPath["path"][number][] = [];
      let cursor = toNode.id;

      while (cursor !== fromNode.id) {
        const p = parent.get(cursor);
        const node = nodeMap.get(cursor);
        if (!node || !p) break;
        path.unshift({
          nodeId: node.id,
          label: node.label,
          type: node.type,
          relationship: p.relationship,
        });
        cursor = p.nodeId;
      }

      const startNode = nodeMap.get(fromNode.id)!;
      path.unshift({
        nodeId: startNode.id,
        label: startNode.label,
        type: startNode.type,
        relationship: null,
      });

      return { from: fromLabel, to: toLabel, found: true, path, totalSteps: path.length - 1 };
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor.nodeId)) {
        visited.add(neighbor.nodeId);
        parent.set(neighbor.nodeId, { nodeId: current, relationship: neighbor.edgeRelation });
        queue.push(neighbor.nodeId);
      }
    }
  }

  return emptyPath;
}

export async function suggestForTopic(
  channelInput: string | null,
  topic: string,
): Promise<{
  readonly node: GraphNode | null;
  readonly related: ReadonlyArray<{ label: string; type: knowledgeRepo.NodeType; relationship: string }>;
  readonly videos: ReadonlyArray<{ title: string; youtubeVideoId: string }>;
}> {
  const channel = await requireChannel(channelInput);
  const node = await knowledgeRepo.findNodeByLabel(channel.id, topic);

  if (!node) {
    return { node: null, related: [], videos: [] };
  }

  const [refs, neighbors] = await Promise.all([
    knowledgeRepo.findVideoRefsForNode(node.id),
    knowledgeRepo.findNeighbors(node.id),
  ]);

  const uniqueRefs = deduplicateByKey(refs, (r) => r.video_id);

  return {
    node: toGraphNode(node),
    related: neighbors.map((n) => ({
      label: n.neighbor_label,
      type: n.neighbor_type,
      relationship: n.relationship,
    })),
    videos: uniqueRefs.map((r) => ({
      title: r.video_title,
      youtubeVideoId: r.youtube_video_id,
    })),
  };
}
