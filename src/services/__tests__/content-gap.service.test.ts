import { describe, test, expect, mock } from "bun:test";

const mockChannel = {
  id: "ch-1",
  youtube_id: "UC123",
  username: "@testchannel",
  name: "Test Channel",
  followers: 5000,
  video_count: 100,
  avatar_url: null,
  banner_url: null,
  last_synced_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

const mockGapAnalysis = {
  id: "g-1",
  channel_id: "ch-1",
  version: 1,
  total_videos_analyzed: 25,
  total_chunks_analyzed: 200,
  topics_covered: [
    {
      id: 1,
      label: "TypeScript",
      description: "TypeScript tutorials",
      videoCount: 5,
      representativeVideoTitles: ["TS Basics"],
    },
  ],
  gaps: [
    {
      topic: "Rust",
      reason: "No coverage",
      confidence: "high" as const,
      priority: 1,
      category: "technology",
      adjacentTopics: ["Go"],
      suggestedVideoTitle: "Getting Started with Rust",
      suggestedAngle: "From TS to Rust",
    },
  ],
  summary: "Good TS coverage, missing Rust.",
  created_at: new Date("2025-01-01"),
};

mock.module("../channel.helpers", () => ({
  requireChannel: () => Promise.resolve(mockChannel),
}));

mock.module("../../repositories/content-gap.repo", () => ({
  findLatest: () => Promise.resolve(mockGapAnalysis),
  findByVersion: () => Promise.resolve(mockGapAnalysis),
  findAll: () => Promise.resolve([mockGapAnalysis]),
  create: () => Promise.resolve(mockGapAnalysis),
}));

mock.module("../../repositories/metadata.repo", () => ({
  findLatest: () => Promise.resolve({ category: "technology" }),
}));

mock.module("../../repositories/video.repo", () => ({
  findRecentTitles: () => Promise.resolve(["TS Basics", "React Hooks"]),
  countByChannelId: () => Promise.resolve(25),
}));

mock.module("../../vector/cluster", () => ({
  fetchChannelEmbeddings: () => Promise.resolve([]),
  clusterEmbeddings: () => Promise.resolve([]),
  fetchChunkContents: () => Promise.resolve([]),
}));

mock.module("../../ai/extract-topics", () => ({
  extractTopicsFromClusters: () => Promise.resolve([]),
}));

mock.module("../../ai/analyze-gaps", () => ({
  analyzeContentGaps: () =>
    Promise.resolve({ gaps: [], summary: "No gaps" }),
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

import { getLatestAnalysis, getAnalysisVersions } from "../content-gap.service";

describe("getLatestAnalysis", () => {
  test("returns latest analysis for channel", async () => {
    const result = await getLatestAnalysis("testchannel");
    expect(result).toBeDefined();
    expect(result!.channelName).toBe("Test Channel");
    expect(result!.handle).toBe("@testchannel");
    expect(result!.totalVideosAnalyzed).toBe(25);
    expect(result!.gaps.length).toBe(1);
  });
});

describe("getAnalysisVersions", () => {
  test("returns channel name and versions", async () => {
    const result = await getAnalysisVersions("testchannel");
    expect(result.channelName).toBe("Test Channel");
    expect(result.versions.length).toBe(1);
  });
});
