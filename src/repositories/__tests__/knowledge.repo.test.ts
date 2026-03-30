import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  normalizeLabel,
  upsertNode,
  upsertNodes,
  upsertEdge,
  addVideoRef,
  findNodesByChannel,
  findTopNodes,
  findEdgesByChannel,
  findNodeById,
  findNodeByLabel,
  findVideoRefsForNode,
  findNeighbors,
  getGraphStats,
  findChunksWithVideos,
  deleteChannelGraph,
  nodeCount,
  type KnowledgeNodeRow,
  type KnowledgeEdgeRow,
} from "../knowledge.repo";

const now = new Date("2025-06-01");

const sampleNode: KnowledgeNodeRow = {
  id: "node-1",
  channel_id: "ch-1",
  label: "React Hooks",
  normalized_label: "react hooks",
  type: "concept",
  description: "React state management",
  importance: 5.2,
  mention_count: 3,
  created_at: now,
  updated_at: now,
};

const sampleEdge: KnowledgeEdgeRow = {
  id: "edge-1",
  channel_id: "ch-1",
  source_id: "node-1",
  target_id: "node-2",
  relationship: "requires",
  weight: 2.0,
  context: "Hooks require React",
  created_at: now,
};

beforeEach(() => {
  clearMockRows();
});

describe("normalizeLabel", () => {
  test("lowercases and trims", () => {
    expect(normalizeLabel("  React Hooks  ")).toBe("react hooks");
  });

  test("collapses whitespace", () => {
    expect(normalizeLabel("React   Hooks")).toBe("react hooks");
  });

  test("handles empty string", () => {
    expect(normalizeLabel("")).toBe("");
  });
});

describe("upsertNode", () => {
  test("returns upserted node", async () => {
    pushMockRows([sampleNode]);
    const result = await upsertNode({
      channelId: "ch-1",
      label: "React Hooks",
      type: "concept",
      description: "React state management",
    });
    expect(result).toEqual(sampleNode);
  });
});

describe("upsertNodes", () => {
  test("returns empty for empty input", async () => {
    const result = await upsertNodes("ch-1", []);
    expect(result).toEqual([]);
  });

  test("returns all upserted nodes", async () => {
    const node2: KnowledgeNodeRow = { ...sampleNode, id: "node-2", label: "TypeScript", normalized_label: "typescript" };
    pushMockRows([sampleNode], [node2]);
    const result = await upsertNodes("ch-1", [
      { label: "React Hooks", type: "concept", description: "hooks" },
      { label: "TypeScript", type: "language", description: "ts" },
    ]);
    expect(result.length).toBe(2);
    expect(result[0]!.label).toBe("React Hooks");
    expect(result[1]!.label).toBe("TypeScript");
  });
});

describe("upsertEdge", () => {
  test("returns upserted edge", async () => {
    pushMockRows([sampleEdge]);
    const result = await upsertEdge({
      channelId: "ch-1",
      sourceLabel: "React Hooks",
      targetLabel: "React",
      relationship: "requires",
      context: "Hooks require React",
    });
    expect(result).toEqual(sampleEdge);
  });

  test("returns null when nodes not found", async () => {
    pushMockRows([]);
    const result = await upsertEdge({
      channelId: "ch-1",
      sourceLabel: "Missing",
      targetLabel: "Also Missing",
      relationship: "related_to",
      context: null,
    });
    expect(result).toBeNull();
  });
});

describe("addVideoRef", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await addVideoRef({
      nodeId: "node-1",
      videoId: "vid-1",
      chunkId: "chunk-1",
      context: "some context",
      relevance: 1.0,
    });
  });
});

describe("findNodesByChannel", () => {
  test("returns nodes ordered by importance", async () => {
    pushMockRows([sampleNode]);
    const result = await findNodesByChannel("ch-1");
    expect(result.length).toBe(1);
    expect(result[0]!.label).toBe("React Hooks");
  });

  test("returns empty for no nodes", async () => {
    pushMockRows([]);
    const result = await findNodesByChannel("ch-empty");
    expect(result).toEqual([]);
  });
});

describe("findTopNodes", () => {
  test("returns limited nodes", async () => {
    pushMockRows([sampleNode]);
    const result = await findTopNodes("ch-1", 5);
    expect(result.length).toBe(1);
  });
});

describe("findEdgesByChannel", () => {
  test("returns edges", async () => {
    pushMockRows([sampleEdge]);
    const result = await findEdgesByChannel("ch-1");
    expect(result.length).toBe(1);
    expect(result[0]!.relationship).toBe("requires");
  });
});

describe("findNodeById", () => {
  test("returns node when found", async () => {
    pushMockRows([sampleNode]);
    const result = await findNodeById("node-1");
    expect(result).toEqual(sampleNode);
  });

  test("returns null when not found", async () => {
    pushMockRows([]);
    const result = await findNodeById("node-missing");
    expect(result).toBeNull();
  });
});

describe("findNodeByLabel", () => {
  test("returns node when found", async () => {
    pushMockRows([sampleNode]);
    const result = await findNodeByLabel("ch-1", "React Hooks");
    expect(result).toEqual(sampleNode);
  });

  test("returns null when not found", async () => {
    pushMockRows([]);
    const result = await findNodeByLabel("ch-1", "Missing");
    expect(result).toBeNull();
  });
});

describe("findVideoRefsForNode", () => {
  test("returns video references", async () => {
    const ref = {
      id: "ref-1",
      node_id: "node-1",
      video_id: "vid-1",
      chunk_id: "chunk-1",
      context: "snippet",
      relevance: 1.0,
      created_at: now,
      video_title: "Intro to Hooks",
      youtube_video_id: "abc123",
    };
    pushMockRows([ref]);
    const result = await findVideoRefsForNode("node-1");
    expect(result.length).toBe(1);
    expect(result[0]!.video_title).toBe("Intro to Hooks");
  });
});

describe("findNeighbors", () => {
  test("returns neighbor edges with labels", async () => {
    const neighbor = {
      ...sampleEdge,
      neighbor_label: "React",
      neighbor_type: "framework" as const,
    };
    pushMockRows([neighbor]);
    const result = await findNeighbors("node-1");
    expect(result.length).toBe(1);
    expect(result[0]!.neighbor_label).toBe("React");
  });
});

describe("getGraphStats", () => {
  test("returns node count, edge count, and types", async () => {
    pushMockRows(
      [{ count: 10 }],
      [{ count: 15 }],
      [{ type: "concept", count: 5 }, { type: "tool", count: 3 }],
    );
    const result = await getGraphStats("ch-1");
    expect(result.nodeCount).toBe(10);
    expect(result.edgeCount).toBe(15);
    expect(result.topTypes.length).toBe(2);
  });
});

describe("findChunksWithVideos", () => {
  test("returns chunks with video info", async () => {
    const chunk = {
      id: "chunk-1",
      video_id: "vid-1",
      content: "React hooks are great",
      video_title: "React Tutorial",
      youtube_video_id: "xyz789",
    };
    pushMockRows([chunk]);
    const result = await findChunksWithVideos("ch-1");
    expect(result.length).toBe(1);
    expect(result[0]!.video_title).toBe("React Tutorial");
  });
});

describe("deleteChannelGraph", () => {
  test("completes without error", async () => {
    pushMockRows([]);
    await deleteChannelGraph("ch-1");
  });
});

describe("nodeCount", () => {
  test("returns count", async () => {
    pushMockRows([{ count: 42 }]);
    const result = await nodeCount("ch-1");
    expect(result).toBe(42);
  });

  test("returns 0 for empty graph", async () => {
    pushMockRows([{ count: 0 }]);
    const result = await nodeCount("ch-empty");
    expect(result).toBe(0);
  });
});
