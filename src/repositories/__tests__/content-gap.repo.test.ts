import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  findLatest,
  findByVersion,
  findAll,
  create,
  type GapAnalysisRow,
} from "../content-gap.repo";

const sampleGap: GapAnalysisRow = {
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
      confidence: "high",
      priority: 1,
      category: "technology",
      adjacentTopics: ["Go", "C++"],
      suggestedVideoTitle: "Getting Started with Rust",
      suggestedAngle: "From TypeScript to Rust",
    },
  ],
  summary: "Good TS coverage, missing Rust and Go content.",
  created_at: new Date("2025-01-01"),
};

beforeEach(() => {
  clearMockRows();
});

describe("findLatest", () => {
  test("returns latest analysis", async () => {
    pushMockRows([sampleGap]);
    const result = await findLatest("ch-1");
    expect(result).toEqual(sampleGap);
  });

  test("returns null when none exists", async () => {
    pushMockRows([]);
    const result = await findLatest("ch-none");
    expect(result).toBeNull();
  });
});

describe("findByVersion", () => {
  test("returns analysis for version", async () => {
    pushMockRows([sampleGap]);
    const result = await findByVersion("ch-1", 1);
    expect(result).toEqual(sampleGap);
  });

  test("returns null for missing version", async () => {
    pushMockRows([]);
    const result = await findByVersion("ch-1", 99);
    expect(result).toBeNull();
  });
});

describe("findAll", () => {
  test("returns all analyses", async () => {
    pushMockRows([sampleGap]);
    const result = await findAll("ch-1");
    expect(result.length).toBe(1);
  });

  test("returns empty for no analyses", async () => {
    pushMockRows([]);
    const result = await findAll("ch-empty");
    expect(result).toEqual([]);
  });
});

describe("create", () => {
  test("creates analysis with auto-version", async () => {
    pushMockRows([{ next_version: 2 }], [{ ...sampleGap, version: 2 }]);
    const result = await create({
      channelId: "ch-1",
      totalVideosAnalyzed: 30,
      totalChunksAnalyzed: 250,
      topicsCovered: sampleGap.topics_covered,
      gaps: sampleGap.gaps,
      summary: "Updated analysis",
    });
    expect(result.version).toBe(2);
  });
});
