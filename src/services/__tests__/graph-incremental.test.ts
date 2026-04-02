import { describe, test, expect, mock } from "bun:test";

const now = new Date("2025-06-01");

const mockChunks = [
  { id: "c1", video_id: "vid-1", content: "React hooks", video_title: "React Tutorial", youtube_video_id: "abc" },
  { id: "c2", video_id: "vid-1", content: "More hooks", video_title: "React Tutorial", youtube_video_id: "abc" },
];

const mockNode = {
  id: "node-1",
  channel_id: "ch-1",
  label: "React",
  normalized_label: "react",
  type: "framework",
  description: "UI lib",
  importance: 5,
  mention_count: 1,
  created_at: now,
  updated_at: now,
};

const mockMetadata = {
  category: "technology",
};

mock.module("../../repositories/knowledge.repo", () => ({
  findChunksByVideoId: () => Promise.resolve(mockChunks),
  updateImportance: () => Promise.resolve(),
  upsertNodes: () => Promise.resolve([mockNode]),
  upsertEdge: () => Promise.resolve(null),
  addVideoRef: () => Promise.resolve(),
  normalizeLabel: (label: string) => label.toLowerCase().trim().replace(/\s+/g, " "),
}));

mock.module("../../repositories/knowledge-build.repo", () => ({
  findProcessedVideoIds: () => Promise.resolve(new Set<string>()),
  markVideoProcessed: () => Promise.resolve(),
}));

mock.module("../../repositories/metadata.repo", () => ({
  findLatest: () => Promise.resolve(mockMetadata),
}));

mock.module("../../ai/extract-knowledge", () => ({
  extractKnowledge: () =>
    Promise.resolve({
      entities: [{ label: "React", type: "framework", description: "UI" }],
      relationships: [],
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

import { extractKnowledgeForVideo } from "../graph-incremental";

describe("extractKnowledgeForVideo", () => {
  test("extracts knowledge for a single video", async () => {
    await extractKnowledgeForVideo("ch-1", "vid-1");
  });

  test("skips already processed videos", async () => {
    mock.module("../../repositories/knowledge-build.repo", () => ({
      findProcessedVideoIds: () => Promise.resolve(new Set(["vid-already"])),
      markVideoProcessed: () => Promise.resolve(),
    }));

    const { extractKnowledgeForVideo: extract2 } = await import("../graph-incremental");
    await extract2("ch-1", "vid-already");
  });

  test("skips videos with no chunks", async () => {
    mock.module("../../repositories/knowledge.repo", () => ({
      findChunksByVideoId: () => Promise.resolve([]),
      updateImportance: () => Promise.resolve(),
      upsertNodes: () => Promise.resolve([]),
      upsertEdge: () => Promise.resolve(null),
      addVideoRef: () => Promise.resolve(),
      normalizeLabel: (l: string) => l.toLowerCase().trim(),
    }));

    mock.module("../../repositories/knowledge-build.repo", () => ({
      findProcessedVideoIds: () => Promise.resolve(new Set<string>()),
      markVideoProcessed: () => Promise.resolve(),
    }));

    const { extractKnowledgeForVideo: extract3 } = await import("../graph-incremental");
    await extract3("ch-1", "vid-empty");
  });
});
