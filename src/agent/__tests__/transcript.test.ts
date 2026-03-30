import { describe, test, expect, mock } from "bun:test";

mock.module("../../repositories/video.repo", () => ({
  findByYoutubeVideoId: (id: string) => {
    if (id === "found") return Promise.resolve({ id: "v-1", title: "Found Video" });
    return Promise.resolve(null);
  },
}));

mock.module("../../repositories/transcript.repo", () => ({
  findByVideoId: (videoId: string) => {
    if (videoId === "v-1")
      return Promise.resolve({
        content: "Full transcript text here. ".repeat(50),
        summary: "A brief summary.",
      });
    return Promise.resolve(null);
  },
}));

import { fetchTranscriptContent } from "../transcript";

describe("fetchTranscriptContent", () => {
  test("returns transcript with summary for existing video", async () => {
    const result = await fetchTranscriptContent("found");
    expect(result).toContain("Summary: A brief summary.");
    expect(result).toContain('Full transcript for "Found Video"');
  });

  test("returns not found message for missing video", async () => {
    const result = await fetchTranscriptContent("missing");
    expect(result).toContain("not found in database");
  });

  test("returns not fetched message when no transcript", async () => {
    // Mock video exists but transcript doesn't
    mock.module("../../repositories/video.repo", () => ({
      findByYoutubeVideoId: () =>
        Promise.resolve({ id: "v-2", title: "No Transcript Video" }),
    }));
    mock.module("../../repositories/transcript.repo", () => ({
      findByVideoId: () => Promise.resolve(null),
    }));

    // Re-import to get new mocks
    const { fetchTranscriptContent: fn } = await import("../transcript");
    const result = await fn("abc");
    expect(result).toContain("has not been fetched yet");
  });
});
