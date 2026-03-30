import { describe, test, expect, mock } from "bun:test";
import { pushMockRows, clearMockRows } from "../../../__test-utils__/db-mock";

// Mock langchain's tool function to just wrap the handler
mock.module("langchain", () => ({
  tool: (handler: Function, config: any) => ({
    name: config.name,
    description: config.description,
    handler,
    invoke: (args: any) => handler(args),
  }),
  createAgent: () => ({}),
}));

mock.module("../../../services/search.service", () => ({
  searchByChannelId: () =>
    Promise.resolve([
      {
        content: "React hooks explained",
        videoTitle: "React Tutorial",
        videoUrl: "https://youtube.com/watch?v=abc",
        similarity: 0.92,
      },
    ]),
}));

mock.module("../../transcript", () => ({
  fetchTranscriptContent: (videoId: string) =>
    Promise.resolve(`Transcript for ${videoId}`),
}));

mock.module("../../../lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    time: () => () => {},
  }),
}));

import { createChannelTools } from "../tools";

describe("createChannelTools", () => {
  test("returns 6 tools", () => {
    clearMockRows();
    const tools = createChannelTools("ch-1");
    expect(tools.length).toBe(6);
  });

  test("tools have correct names", () => {
    clearMockRows();
    const tools = createChannelTools("ch-1");
    const names = tools.map((t: any) => t.name);
    expect(names).toContain("list_videos");
    expect(names).toContain("get_transcript");
    expect(names).toContain("semantic_search");
    expect(names).toContain("get_channel_info");
    expect(names).toContain("get_latest_digest");
    expect(names).toContain("find_content_gaps");
  });

  test("list_videos returns formatted video list", async () => {
    clearMockRows();
    pushMockRows([
      {
        youtube_video_id: "abc",
        title: "Test Video",
        view_count: 5000,
        duration_sec: 600,
        duration_formatted: "10:00",
      },
    ]);
    const tools = createChannelTools("ch-1");
    const listVideos = tools.find((t: any) => t.name === "list_videos");
    const result = await (listVideos as any).invoke({ limit: 10 });
    expect(result).toContain("Test Video");
    expect(result).toContain("5.0K views");
  });

  test("list_videos handles empty results", async () => {
    clearMockRows();
    pushMockRows([]);
    const tools = createChannelTools("ch-1");
    const listVideos = tools.find((t: any) => t.name === "list_videos");
    const result = await (listVideos as any).invoke({ limit: 10 });
    expect(result).toContain("No videos found");
  });

  test("get_transcript returns transcript content", async () => {
    clearMockRows();
    const tools = createChannelTools("ch-1");
    const getTx = tools.find((t: any) => t.name === "get_transcript");
    const result = await (getTx as any).invoke({ videoId: "abc123" });
    expect(result).toContain("Transcript for abc123");
  });

  test("semantic_search returns formatted results", async () => {
    clearMockRows();
    const tools = createChannelTools("ch-1");
    const search = tools.find((t: any) => t.name === "semantic_search");
    const result = await (search as any).invoke({
      query: "React hooks",
      limit: 5,
    });
    expect(result).toContain("React Tutorial");
    expect(result).toContain("92.0%");
  });

  test("get_channel_info returns metadata", async () => {
    clearMockRows();
    pushMockRows([
      {
        overview: "A tech channel",
        associated_video_types: "tutorials",
        category: "technology",
        language: "en",
        version: 1,
      },
    ]);
    const tools = createChannelTools("ch-1");
    const info = tools.find((t: any) => t.name === "get_channel_info");
    const result = await (info as any).invoke({});
    expect(result).toContain("A tech channel");
    expect(result).toContain("technology");
  });

  test("get_channel_info handles no metadata", async () => {
    clearMockRows();
    pushMockRows([]);
    const tools = createChannelTools("ch-1");
    const info = tools.find((t: any) => t.name === "get_channel_info");
    const result = await (info as any).invoke({});
    expect(result).toContain("not been generated");
  });

  test("get_latest_digest returns digest content", async () => {
    clearMockRows();
    pushMockRows([
      {
        summary: "Great week for the channel",
        highlights: [
          {
            title: "Top Video",
            reason: "Most views",
            viewVelocity: 1000,
          },
        ],
        topic_clusters: [
          { topic: "React", description: "React content" },
        ],
        trend_analysis: "Growing steadily",
        new_video_count: 5,
        period_start: new Date("2025-01-01"),
        period_end: new Date("2025-01-07"),
      },
    ]);
    const tools = createChannelTools("ch-1");
    const digest = tools.find((t: any) => t.name === "get_latest_digest");
    const result = await (digest as any).invoke({});
    expect(result).toContain("Great week for the channel");
    expect(result).toContain("Top Video");
  });

  test("get_latest_digest handles no digest", async () => {
    clearMockRows();
    pushMockRows([]);
    const tools = createChannelTools("ch-1");
    const digest = tools.find((t: any) => t.name === "get_latest_digest");
    const result = await (digest as any).invoke({});
    expect(result).toContain("No digest has been generated");
  });

  test("find_content_gaps returns gap analysis", async () => {
    clearMockRows();
    pushMockRows([
      {
        total_videos_analyzed: 25,
        topics_covered: [
          { id: 1, label: "TypeScript" },
        ],
        gaps: [
          {
            topic: "Rust",
            priority: 90,
            confidence: "high",
            reason: "No coverage",
            suggestedVideoTitle: "Getting Started with Rust",
            suggestedAngle: "For TS developers",
          },
        ],
        summary: "Good TS coverage, missing Rust",
      },
    ]);
    const tools = createChannelTools("ch-1");
    const gaps = tools.find((t: any) => t.name === "find_content_gaps");
    const result = await (gaps as any).invoke({ limit: 5 });
    expect(result).toContain("Rust");
    expect(result).toContain("Getting Started with Rust");
  });

  test("find_content_gaps handles no analysis", async () => {
    clearMockRows();
    pushMockRows([]);
    const tools = createChannelTools("ch-1");
    const gaps = tools.find((t: any) => t.name === "find_content_gaps");
    const result = await (gaps as any).invoke({ limit: 5 });
    expect(result).toContain("not available yet");
  });
});
