import { describe, test, expect, mock } from "bun:test";
import { pushMockRows, clearMockRows } from "../../../__test-utils__/db-mock";

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
  searchAcrossChannels: () =>
    Promise.resolve([
      {
        content: "React explained",
        channelId: "ch-1",
        channelName: "Channel A",
        videoTitle: "React Tutorial",
        videoUrl: "https://youtube.com/watch?v=1",
        similarity: 0.9,
      },
      {
        content: "React deep dive",
        channelId: "ch-2",
        channelName: "Channel B",
        videoTitle: "Advanced React",
        videoUrl: "https://youtube.com/watch?v=2",
        similarity: 0.85,
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

import { createMultiChannelTools } from "../tools";

const mockCtx = {
  channelIds: ["ch-1", "ch-2"] as ReadonlyArray<string>,
  channelsByUsername: new Map([
    [
      "channelA",
      {
        id: "ch-1",
        youtube_id: "UC1",
        username: "channelA",
        name: "Channel A",
        followers: 10000,
        video_count: 50,
        avatar_url: null,
        banner_url: null,
        last_synced_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  ]) as ReadonlyMap<string, any>,
  metadataByChannelId: new Map([
    [
      "ch-1",
      {
        overview: "A tech channel",
        associated_video_types: "tutorials",
        category: "technology",
        language: "en",
      },
    ],
  ]) as ReadonlyMap<string, any>,
};

describe("createMultiChannelTools", () => {
  test("returns 4 tools", () => {
    const tools = createMultiChannelTools(mockCtx);
    expect(tools.length).toBe(4);
  });

  test("tools have correct names", () => {
    const tools = createMultiChannelTools(mockCtx);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain("cross_channel_search");
    expect(names).toContain("list_channel_videos");
    expect(names).toContain("get_transcript");
    expect(names).toContain("get_channel_overview");
  });

  test("cross_channel_search returns grouped results", async () => {
    const tools = createMultiChannelTools(mockCtx);
    const search = tools.find((t: any) => t.name === "cross_channel_search");
    const result = await (search as any).invoke({
      query: "React",
      limit: 10,
    });
    expect(result).toContain("Channel A");
    expect(result).toContain("Channel B");
    expect(result).toContain("90.0%");
  });

  test("list_channel_videos returns video list", async () => {
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
    const tools = createMultiChannelTools(mockCtx);
    const list = tools.find((t: any) => t.name === "list_channel_videos");
    const result = await (list as any).invoke({
      channel: "channelA",
      limit: 10,
    });
    expect(result).toContain("Test Video");
    expect(result).toContain("@channelA");
  });

  test("list_channel_videos handles unknown channel", async () => {
    const tools = createMultiChannelTools(mockCtx);
    const list = tools.find((t: any) => t.name === "list_channel_videos");
    const result = await (list as any).invoke({
      channel: "unknown",
      limit: 10,
    });
    expect(result).toContain("not in the available channels");
  });

  test("get_transcript returns content", async () => {
    const tools = createMultiChannelTools(mockCtx);
    const tx = tools.find((t: any) => t.name === "get_transcript");
    const result = await (tx as any).invoke({ videoId: "xyz" });
    expect(result).toContain("Transcript for xyz");
  });

  test("get_channel_overview returns metadata", async () => {
    const tools = createMultiChannelTools(mockCtx);
    const overview = tools.find(
      (t: any) => t.name === "get_channel_overview",
    );
    const result = await (overview as any).invoke({ channel: "channelA" });
    expect(result).toContain("A tech channel");
    expect(result).toContain("technology");
  });

  test("get_channel_overview handles unknown channel", async () => {
    const tools = createMultiChannelTools(mockCtx);
    const overview = tools.find(
      (t: any) => t.name === "get_channel_overview",
    );
    const result = await (overview as any).invoke({ channel: "unknown" });
    expect(result).toContain("not in the available channels");
  });
});
