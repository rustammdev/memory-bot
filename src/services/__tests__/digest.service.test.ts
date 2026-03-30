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

const mockDigest = {
  id: "d-1",
  channel_id: "ch-1",
  version: 1,
  status: "completed" as const,
  period_start: new Date("2025-01-01"),
  period_end: new Date("2025-01-07"),
  new_video_count: 5,
  total_views: 50000,
  summary: "Weekly digest summary",
  highlights: [],
  topic_clusters: [],
  trend_analysis: "Views up 20%",
  persona_style: "technology",
  generated_at: new Date("2025-01-07"),
  error_message: null,
  created_at: new Date("2025-01-01"),
};

mock.module("../channel.helpers", () => ({
  requireChannel: () => Promise.resolve(mockChannel),
}));

mock.module("../../repositories/digest.repo", () => ({
  findLatest: () => Promise.resolve(mockDigest),
  findByVersion: (channelId: string, version: number) =>
    version === 1 ? Promise.resolve(mockDigest) : Promise.resolve(null),
  findAll: () => Promise.resolve([mockDigest]),
  findPrevious: () => Promise.resolve(null),
  create: () => Promise.resolve({ ...mockDigest, id: "d-new", version: 2, status: "pending" }),
  updateById: (_id: string, data: any) =>
    Promise.resolve({ ...mockDigest, ...data, id: _id }),
}));

mock.module("../../repositories/video.repo", () => ({
  findNewSinceWithSummaries: () => Promise.resolve([]),
  findWithViewVelocity: () => Promise.resolve([]),
}));

mock.module("../../repositories/metadata.repo", () => ({
  findLatest: () => Promise.resolve({ category: "technology" }),
}));

mock.module("../../memory/client", () => ({
  recallMemories: () => Promise.resolve(""),
}));

mock.module("../../ai/generate-digest", () => ({
  generateDigest: () =>
    Promise.resolve({
      summary: "AI generated digest",
      highlights: [],
      topicClusters: [],
      trendAnalysis: "Stable",
    }),
}));

mock.module("../../agent/channel/persona", () => ({
  PERSONA_MAP: {
    technology: { tone: "enthusiastic", style: "tech-savvy" },
    other: { tone: "friendly", style: "general" },
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

import { getLatestDigest, getDigestHistory } from "../digest.service";

describe("getLatestDigest", () => {
  test("returns latest digest for channel", async () => {
    const result = await getLatestDigest("testchannel");
    expect(result).toBeDefined();
    expect(result!.channelName).toBe("Test Channel");
    expect(result!.handle).toBe("@testchannel");
    expect(result!.digest.version).toBe(1);
    expect(result!.digest.summary).toBe("Weekly digest summary");
  });

  test("returns specific version when provided", async () => {
    const result = await getLatestDigest("testchannel", 1);
    expect(result).toBeDefined();
    expect(result!.digest.version).toBe(1);
  });

  test("returns null when digest not found", async () => {
    const result = await getLatestDigest("testchannel", 999);
    expect(result).toBeNull();
  });
});

describe("getDigestHistory", () => {
  test("returns channel name and digests", async () => {
    const result = await getDigestHistory("testchannel");
    expect(result.channelName).toBe("Test Channel");
    expect(result.digests.length).toBe(1);
  });
});
