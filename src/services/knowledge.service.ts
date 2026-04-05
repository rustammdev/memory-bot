import { deduplicateByKey } from "../lib/collection";
import { requireChannel } from "./channel.helpers";
import * as knowledgeRepo from "../repositories/knowledge.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { startBuild, getBuildStatus, type BuildStatus, type TagFilter } from "./graph-builder";

export type { TagFilter };

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

export { type BuildStatus } from "./graph-builder";

export async function buildChannelGraph(
  channelInput: string | null,
  force = false,
  limit?: number,
  tags?: TagFilter,
): Promise<BuildStatus> {
  const channel = await requireChannel(channelInput);
  return buildChannelGraphById(channel.id, force, limit, tags);
}

export async function buildChannelGraphById(
  channelId: string,
  force = false,
  limit?: number,
  tags?: TagFilter,
): Promise<BuildStatus> {
  const metadata = await metadataRepo.findLatest(channelId);
  const category = metadata?.category ?? "other";

  return startBuild(channelId, category, force, limit, tags);
}

export async function getChannelBuildStatus(
  channelInput: string | null,
): Promise<BuildStatus | null> {
  const channel = await requireChannel(channelInput);
  return getBuildStatus(channel.id);
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
