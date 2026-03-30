import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  insertChunks,
  searchByChannel,
  searchByChannels,
  deleteByTranscript,
  type ChunkRecord,
} from "../store";

beforeEach(() => {
  clearMockRows();
});

describe("insertChunks", () => {
  test("does nothing for empty array", async () => {
    await insertChunks([]);
    // No error = success
  });

  test("inserts chunks within transaction", async () => {
    // Mock: transaction insert returns empty, vectorized update returns empty
    pushMockRows([], []);
    const chunks: ChunkRecord[] = [
      {
        channelId: "ch-1",
        videoId: "v-1",
        transcriptId: "t-1",
        chunkIndex: 0,
        content: "Hello world",
        embedding: [0.1, 0.2, 0.3],
        importance: 0.8,
      },
    ];
    await insertChunks(chunks, "t-1");
  });

  test("inserts multiple chunks", async () => {
    pushMockRows([], [], []);
    const chunks: ChunkRecord[] = [
      {
        channelId: "ch-1",
        videoId: "v-1",
        transcriptId: "t-1",
        chunkIndex: 0,
        content: "Part 1",
        embedding: [0.1, 0.2],
        importance: 0.5,
      },
      {
        channelId: "ch-1",
        videoId: "v-1",
        transcriptId: "t-1",
        chunkIndex: 1,
        content: "Part 2",
        embedding: [0.3, 0.4],
        importance: 0.5,
      },
    ];
    await insertChunks(chunks, "t-1");
  });
});

describe("searchByChannel", () => {
  test("returns mapped search results", async () => {
    pushMockRows([
      {
        content: "TypeScript is great",
        video_title: "TS Tutorial",
        video_url: "https://youtube.com/watch?v=123",
        similarity: 0.95,
      },
    ]);

    const results = await searchByChannel("ch-1", [0.1, 0.2, 0.3]);
    expect(results.length).toBe(1);
    expect(results[0]!.content).toBe("TypeScript is great");
    expect(results[0]!.videoTitle).toBe("TS Tutorial");
    expect(results[0]!.videoUrl).toBe("https://youtube.com/watch?v=123");
    expect(results[0]!.similarity).toBe(0.95);
  });

  test("returns empty for no matches", async () => {
    pushMockRows([]);
    const results = await searchByChannel("ch-1", [0.1, 0.2, 0.3]);
    expect(results).toEqual([]);
  });
});

describe("searchByChannels", () => {
  test("returns empty for empty channel list", async () => {
    const results = await searchByChannels([], [0.1, 0.2, 0.3]);
    expect(results).toEqual([]);
  });

  test("returns multi-channel results", async () => {
    pushMockRows([
      {
        content: "Hello",
        channel_id: "ch-1",
        channel_name: "Channel A",
        video_title: "Video 1",
        video_url: "https://youtube.com/watch?v=1",
        similarity: 0.9,
      },
    ]);

    const results = await searchByChannels(["ch-1", "ch-2"], [0.1, 0.2]);
    expect(results.length).toBe(1);
    expect(results[0]!.channelId).toBe("ch-1");
    expect(results[0]!.channelName).toBe("Channel A");
  });
});

describe("deleteByTranscript", () => {
  test("deletes chunks by transcript id", async () => {
    pushMockRows([]);
    await deleteByTranscript("t-1");
    // No error = success
  });
});
