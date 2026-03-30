import { describe, test, expect, mock } from "bun:test";

const now = new Date("2025-06-01");

const mockChannel = {
  id: "ch-1",
  youtube_id: "UC123",
  username: "@testchannel",
  name: "Test Channel",
  followers: 5000,
  video_count: 50,
  avatar_url: null,
  banner_url: null,
  last_synced_at: now,
  created_at: now,
  updated_at: now,
};

const mockMetadata = {
  id: "meta-1",
  channel_id: "ch-1",
  version: 1,
  overview: "A tech channel",
  category: "technology",
  language: "en",
  associated_video_types: "tutorials",
  created_at: now,
};

const mockNode = {
  id: "node-1",
  channel_id: "ch-1",
  label: "React Hooks",
  normalized_label: "react hooks",
  type: "concept",
  description: "State management",
  importance: 5.0,
  mention_count: 3,
  created_at: now,
  updated_at: now,
};

const mockNode2 = {
  ...mockNode,
  id: "node-2",
  label: "TypeScript",
  normalized_label: "typescript",
  type: "language",
};

const mockEdge = {
  id: "edge-1",
  channel_id: "ch-1",
  source_id: "node-1",
  target_id: "node-2",
  relationship: "used_with",
  weight: 1.0,
  context: "TS with React",
  created_at: now,
};

const mockVideoRef = {
  id: "ref-1",
  node_id: "node-1",
  video_id: "vid-1",
  chunk_id: "chunk-1",
  context: "React hooks snippet",
  relevance: 1.0,
  created_at: now,
  video_title: "React Tutorial",
  youtube_video_id: "abc123",
};

const mockNeighbor = {
  ...mockEdge,
  neighbor_label: "TypeScript",
  neighbor_type: "language",
};

mock.module("../channel.helpers", () => ({
  requireChannel: () => Promise.resolve(mockChannel),
}));

mock.module("../../repositories/metadata.repo", () => ({
  findLatest: () => Promise.resolve(mockMetadata),
}));

mock.module("../../repositories/knowledge.repo", () => ({
  nodeCount: () => Promise.resolve(5),
  findNodesByChannel: () => Promise.resolve([mockNode, mockNode2]),
  findEdgesByChannel: () => Promise.resolve([mockEdge]),
  findNodeById: (id: string) => {
    if (id === "node-1") return Promise.resolve(mockNode);
    return Promise.resolve(null);
  },
  findNodeByLabel: (_channelId: string, label: string) => {
    const lower = label.toLowerCase().trim();
    if (lower === "react hooks") return Promise.resolve(mockNode);
    if (lower === "typescript") return Promise.resolve(mockNode2);
    return Promise.resolve(null);
  },
  findVideoRefsForNode: () => Promise.resolve([mockVideoRef]),
  findNeighbors: () => Promise.resolve([mockNeighbor]),
  findChunksWithVideos: () =>
    Promise.resolve([
      { id: "c1", video_id: "vid-1", content: "React hooks content", video_title: "React Tutorial", youtube_video_id: "abc" },
      { id: "c2", video_id: "vid-1", content: "More hooks content", video_title: "React Tutorial", youtube_video_id: "abc" },
      { id: "c3", video_id: "vid-1", content: "TypeScript content", video_title: "React Tutorial", youtube_video_id: "abc" },
      { id: "c4", video_id: "vid-1", content: "useState content", video_title: "React Tutorial", youtube_video_id: "abc" },
      { id: "c5", video_id: "vid-1", content: "Final content", video_title: "React Tutorial", youtube_video_id: "abc" },
    ]),
  upsertNodes: () => Promise.resolve([mockNode]),
  upsertEdge: () => Promise.resolve(mockEdge),
  addVideoRef: () => Promise.resolve(),
  updateImportance: () => Promise.resolve(),
  deleteChannelGraph: () => Promise.resolve(),
  normalizeLabel: (label: string) => label.toLowerCase().trim().replace(/\s+/g, " "),
}));

mock.module("../../ai/extract-knowledge", () => ({
  extractKnowledge: () =>
    Promise.resolve({
      entities: [{ label: "React Hooks", type: "concept", description: "hooks" }],
      relationships: [{ source: "React Hooks", target: "TypeScript", type: "used_with", context: "ctx" }],
    }),
}));

mock.module("../../lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    time: () => () => {},
  }),
}));

import {
  getChannelGraph,
  getNodeDetails,
  findLearningPath,
  findLearningPathByChannelId,
  suggestForTopic,
} from "../knowledge.service";

describe("getChannelGraph", () => {
  test("returns graph with nodes and edges", async () => {
    const result = await getChannelGraph("testchannel");

    expect(result.channelName).toBe("Test Channel");
    expect(result.handle).toBe("@testchannel");
    expect(result.category).toBe("technology");
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
    expect(result.nodes[0]!.label).toBe("React Hooks");
    expect(result.edges[0]!.relationship).toBe("used_with");
  });

  test("maps node rows to GraphNode shape", async () => {
    const result = await getChannelGraph("testchannel");
    const node = result.nodes[0]!;

    expect(node.id).toBe("node-1");
    expect(node.label).toBe("React Hooks");
    expect(node.type).toBe("concept");
    expect(node.importance).toBe(5.0);
    expect(node.mentionCount).toBe(3);
  });
});

describe("getNodeDetails", () => {
  test("returns node with videos and neighbors", async () => {
    const result = await getNodeDetails("node-1");

    expect(result).not.toBeNull();
    expect(result!.label).toBe("React Hooks");
    expect(result!.videos.length).toBe(1);
    expect(result!.videos[0]!.title).toBe("React Tutorial");
    expect(result!.neighbors.length).toBe(1);
    expect(result!.neighbors[0]!.label).toBe("TypeScript");
  });

  test("returns null for missing node", async () => {
    const result = await getNodeDetails("node-missing");
    expect(result).toBeNull();
  });

  test("determines neighbor direction correctly", async () => {
    const result = await getNodeDetails("node-1");
    const neighbor = result!.neighbors[0]!;

    expect(neighbor.direction).toBe("outgoing");
    expect(neighbor.relationship).toBe("used_with");
  });
});

describe("findLearningPath", () => {
  test("finds path between two connected nodes", async () => {
    const result = await findLearningPath("testchannel", "React Hooks", "TypeScript");

    expect(result.found).toBe(true);
    expect(result.from).toBe("React Hooks");
    expect(result.to).toBe("TypeScript");
    expect(result.path.length).toBeGreaterThan(0);
    expect(result.totalSteps).toBeGreaterThan(0);
  });

  test("returns not found for missing start node", async () => {
    const result = await findLearningPath("testchannel", "Missing", "TypeScript");
    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
  });

  test("returns not found for missing end node", async () => {
    const result = await findLearningPath("testchannel", "React Hooks", "Missing");
    expect(result.found).toBe(false);
  });
});

describe("findLearningPathByChannelId", () => {
  test("builds adjacency list and finds shortest path", async () => {
    const result = await findLearningPathByChannelId("ch-1", "React Hooks", "TypeScript");

    expect(result.found).toBe(true);
    expect(result.path[0]!.label).toBe("React Hooks");
    expect(result.path[result.path.length - 1]!.label).toBe("TypeScript");
  });

  test("start node has null relationship", async () => {
    const result = await findLearningPathByChannelId("ch-1", "React Hooks", "TypeScript");

    expect(result.path[0]!.relationship).toBeNull();
  });
});

describe("suggestForTopic", () => {
  test("returns node, related topics, and videos for existing topic", async () => {
    const result = await suggestForTopic("testchannel", "React Hooks");

    expect(result.node).not.toBeNull();
    expect(result.node!.label).toBe("React Hooks");
    expect(result.related.length).toBe(1);
    expect(result.related[0]!.label).toBe("TypeScript");
    expect(result.videos.length).toBe(1);
    expect(result.videos[0]!.title).toBe("React Tutorial");
  });

  test("returns empty result for unknown topic", async () => {
    const result = await suggestForTopic("testchannel", "Unknown Topic");

    expect(result.node).toBeNull();
    expect(result.related).toEqual([]);
    expect(result.videos).toEqual([]);
  });
});
