import { describe, test, expect, mock } from "bun:test";

const mockSearchResults = [
  {
    content: "TypeScript is great",
    videoTitle: "TS Tutorial",
    videoUrl: "https://youtube.com/watch?v=123",
    similarity: 0.95,
  },
];

mock.module("../../vector/embedder", () => ({
  embedText: () => Promise.resolve([0.1, 0.2, 0.3]),
}));

mock.module("../../vector/store", () => ({
  searchByChannel: () => Promise.resolve(mockSearchResults),
  searchByChannels: () =>
    Promise.resolve(
      mockSearchResults.map((r) => ({
        ...r,
        channelId: "ch-1",
        channelName: "Test Channel",
      })),
    ),
}));

mock.module("../channel.helpers", () => ({
  requireChannel: () =>
    Promise.resolve({
      id: "ch-1",
      youtube_id: "UC123",
      username: "@testchannel",
      name: "Test Channel",
    }),
}));

import {
  searchByChannelId,
  searchAcrossChannels,
  searchChannelContent,
} from "../search.service";

describe("searchByChannelId", () => {
  test("returns search results", async () => {
    const results = await searchByChannelId("ch-1", "TypeScript");
    expect(results.length).toBe(1);
    expect(results[0]!.content).toBe("TypeScript is great");
    expect(results[0]!.similarity).toBe(0.95);
  });

  test("uses default limit", async () => {
    const results = await searchByChannelId("ch-1", "test");
    expect(results).toBeDefined();
  });
});

describe("searchAcrossChannels", () => {
  test("returns multi-channel results", async () => {
    const results = await searchAcrossChannels(["ch-1", "ch-2"], "TypeScript");
    expect(results.length).toBe(1);
    expect(results[0]!.channelId).toBe("ch-1");
  });
});

describe("searchChannelContent", () => {
  test("resolves channel and searches", async () => {
    const results = await searchChannelContent("testchannel", "TypeScript");
    expect(results.length).toBe(1);
  });
});
