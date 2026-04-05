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

const mockSummaries = [
  { video_id: "vid-1", content: "This video explains React hooks including useState and useEffect.", video_title: "React Tutorial", youtube_video_id: "abc" },
  { video_id: "vid-2", content: "TypeScript basics covering generics and advanced types.", video_title: "TS Intro", youtube_video_id: "def" },
  { video_id: "vid-3", content: "Node.js streams and async patterns for scalable backends.", video_title: "Node Streams", youtube_video_id: "ghi" },
  { video_id: "vid-4", content: "Docker containers and orchestration with Kubernetes.", video_title: "Docker Intro", youtube_video_id: "jkl" },
  { video_id: "vid-5", content: "GraphQL vs REST API design patterns comparison.", video_title: "API Design", youtube_video_id: "mno" },
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
  findVideoSummaries: () => Promise.resolve(mockSummaries),
  deleteChannelGraph: () => Promise.resolve(),
  updateImportance: () => Promise.resolve(),
  upsertNodes: () => Promise.resolve([mockNode]),
  upsertEdge: () => Promise.resolve(null),
  addVideoRef: () => Promise.resolve(),
  normalizeLabel: (label: string) => label.toLowerCase().trim().replace(/\s+/g, " "),
}));

mock.module("../../ai/extract-knowledge", () => ({
  extractKnowledge: (_videos: unknown[], _category: string) =>
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

import { startBuild, getBuildStatus, processBatch } from "../graph-builder";

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

describe("processBatch", () => {
  test("processes batch of summaries without error", async () => {
    await processBatch("ch-1", mockSummaries.slice(0, 3), "technology");
  });

  test("handles empty batch gracefully", async () => {
    await processBatch("ch-1", [], "technology");
  });
});
