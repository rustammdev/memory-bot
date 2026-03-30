import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  findByVideoId,
  findTranscribedVideoIds,
  upsert,
  type TranscriptRow,
} from "../transcript.repo";

const sampleTranscript: TranscriptRow = {
  id: "t-1",
  video_id: "v-1",
  content: "Hello, this is a transcript content for testing.",
  summary: "A test transcript summary.",
  language: "en",
  vectorized: false,
  created_at: new Date("2025-01-01"),
};

beforeEach(() => {
  clearMockRows();
});

describe("findByVideoId", () => {
  test("returns transcript when found", async () => {
    pushMockRows([sampleTranscript]);
    const result = await findByVideoId("v-1");
    expect(result).toEqual(sampleTranscript);
  });

  test("returns null when not found", async () => {
    pushMockRows([]);
    const result = await findByVideoId("v-none");
    expect(result).toBeNull();
  });

  test("uses default language 'en'", async () => {
    pushMockRows([sampleTranscript]);
    const result = await findByVideoId("v-1");
    expect(result?.language).toBe("en");
  });
});

describe("findTranscribedVideoIds", () => {
  test("returns set of video ids", async () => {
    pushMockRows([{ id: "v-1" }, { id: "v-2" }]);
    const result = await findTranscribedVideoIds("ch-1");
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has("v-1")).toBe(true);
    expect(result.has("v-2")).toBe(true);
  });

  test("returns empty set when none found", async () => {
    pushMockRows([]);
    const result = await findTranscribedVideoIds("ch-none");
    expect(result.size).toBe(0);
  });
});

describe("upsert", () => {
  test("returns upserted transcript", async () => {
    pushMockRows([sampleTranscript]);
    const result = await upsert({
      videoId: "v-1",
      content: "Hello, this is a transcript content for testing.",
      summary: "A test transcript summary.",
    });
    expect(result).toEqual(sampleTranscript);
  });

  test("handles optional fields", async () => {
    pushMockRows([{ ...sampleTranscript, summary: null, language: "en" }]);
    const result = await upsert({
      videoId: "v-1",
      content: "Content only",
    });
    expect(result.video_id).toBe("v-1");
  });
});
