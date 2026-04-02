import { describe, test, expect, mock } from "bun:test";

const now = new Date("2025-06-01");

const mockBuildRow = {
  id: "build-1",
  channel_id: "ch-1",
  status: "running" as const,
  total_videos: 2,
  processed_videos: 0,
  error: null,
  started_at: now,
  completed_at: null,
};

const mockChunks = [
  { id: "c1", video_id: "vid-1", content: "React hooks explained here", video_title: "React Tutorial", youtube_video_id: "abc" },
  { id: "c2", video_id: "vid-1", content: "More about hooks", video_title: "React Tutorial", youtube_video_id: "abc" },
  { id: "c3", video_id: "vid-2", content: "TypeScript basics", video_title: "TS Intro", youtube_video_id: "def" },
  { id: "c4", video_id: "vid-2", content: "TS generics deep dive", video_title: "TS Intro", youtube_video_id: "def" },
  { id: "c5", video_id: "vid-2", content: "TS advanced types", video_title: "TS Intro", youtube_video_id: "def" },
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

mock.module("../../repositories/knowledge-build.repo", () => ({
  createBuild: () => Promise.resolve(mockBuildRow),
  updateProgress: () => Promise.resolve(),
  completeBuild: () => Promise.resolve(),
  failBuild: () => Promise.resolve(),
  findLatestBuild: () => Promise.resolve(mockBuildRow),
  markVideoProcessed: () => Promise.resolve(),
  findProcessedVideoIds: () => Promise.resolve(new Set<string>()),
  clearProcessedVideos: () => Promise.resolve(),
  markStaleBuildsFailed: () => Promise.resolve(),
}));

mock.module("../../repositories/knowledge.repo", () => ({
  findChunksWithVideos: () => Promise.resolve(mockChunks),
  deleteChannelGraph: () => Promise.resolve(),
  updateImportance: () => Promise.resolve(),
  upsertNodes: () => Promise.resolve([mockNode]),
  upsertEdge: () => Promise.resolve(null),
  addVideoRef: () => Promise.resolve(),
  normalizeLabel: (label: string) => label.toLowerCase().trim().replace(/\s+/g, " "),
}));

mock.module("../../ai/extract-knowledge", () => ({
  extractKnowledge: () =>
    Promise.resolve({
      entities: [{ label: "React", type: "framework", description: "UI lib" }],
      relationships: [],
    }),
}));

mock.module("../../lib/errors", () => ({
  ConflictError: class extends Error {
    statusCode = 409;
    constructor(msg: string) { super(msg); }
  },
  ValidationError: class extends Error {
    statusCode = 400;
    constructor(msg: string) { super(msg); }
  },
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

import { startBuild, getBuildStatus, processVideo } from "../graph-builder";

describe("startBuild", () => {
  test("returns build status with running state", async () => {
    const result = await startBuild("ch-1", "technology", false);
    expect(result.buildId).toBe("build-1");
    expect(result.status).toBe("running");
    expect(result.totalVideos).toBeGreaterThan(0);
    expect(result.processedVideos).toBe(0);
    expect(result.startedAt).toBeDefined();
  });

  test("returns build status for force build", async () => {
    const result = await startBuild("ch-force", "technology", true);
    expect(result.status).toBe("running");
  });
});

describe("getBuildStatus", () => {
  test("returns latest build from DB when no active build", async () => {
    const result = await getBuildStatus("ch-other");
    expect(result).not.toBeNull();
    expect(result!.buildId).toBe("build-1");
  });
});

describe("processVideo", () => {
  test("processes chunks without error", async () => {
    await processVideo("ch-1", mockChunks.slice(0, 2), "technology");
  });

  test("handles empty chunks gracefully", async () => {
    await processVideo("ch-1", [], "technology");
  });
});
