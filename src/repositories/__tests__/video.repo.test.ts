import { describe, test, expect, beforeEach } from "bun:test";
import { pushMockRows, clearMockRows } from "../../__test-utils__/db-mock";
import {
  findByChannelId,
  findByYoutubeVideoId,
  bulkUpsert,
  searchByChannelId,
  findRecentTitles,
  countByChannelId,
  getMaxViewCount,
  findNewSince,
  findWithViewVelocity,
  findNewSinceWithSummaries,
  sanitizeTags,
  type VideoRow,
} from "../video.repo";

const sampleVideo: VideoRow = {
  id: "v-1",
  channel_id: "ch-1",
  youtube_video_id: "abc123",
  title: "Test Video",
  url: "https://youtube.com/watch?v=abc123",
  view_count: 5000,
  duration_sec: 600,
  duration_formatted: "10:00",
  thumbnail_default: null,
  thumbnail_medium: null,
  thumbnail_high: null,
  thumbnail_maxres: null,
  tags: [],
  uploaded_at: new Date("2025-01-01"),
  synced_at: new Date("2025-01-01"),
  created_at: new Date("2025-01-01"),
};

beforeEach(() => {
  clearMockRows();
});

describe("findByChannelId", () => {
  test("returns videos for channel", async () => {
    pushMockRows([sampleVideo]);
    const result = await findByChannelId("ch-1");
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(sampleVideo);
  });

  test("returns empty array when no videos", async () => {
    pushMockRows([]);
    const result = await findByChannelId("ch-empty");
    expect(result).toEqual([]);
  });
});

describe("findByYoutubeVideoId", () => {
  test("returns video when found", async () => {
    pushMockRows([sampleVideo]);
    const result = await findByYoutubeVideoId("abc123");
    expect(result).toEqual(sampleVideo);
  });

  test("returns null when not found", async () => {
    pushMockRows([]);
    const result = await findByYoutubeVideoId("nonexistent");
    expect(result).toBeNull();
  });
});

describe("bulkUpsert", () => {
  test("returns empty array for empty input", async () => {
    const result = await bulkUpsert([]);
    expect(result).toEqual([]);
  });

  test("returns upserted videos", async () => {
    pushMockRows([sampleVideo]);
    const result = await bulkUpsert([
      {
        channelId: "ch-1",
        youtubeVideoId: "abc123",
        title: "Test Video",
        url: "https://youtube.com/watch?v=abc123",
        viewCount: 5000,
      },
    ]);
    expect(result.length).toBe(1);
  });
});

describe("searchByChannelId", () => {
  test("returns videos matching query", async () => {
    pushMockRows([sampleVideo]);
    const result = await searchByChannelId("ch-1", "Test");
    expect(result.length).toBe(1);
  });

  test("returns videos without query", async () => {
    pushMockRows([sampleVideo]);
    const result = await searchByChannelId("ch-1");
    expect(result.length).toBe(1);
  });

  test("returns empty when no match", async () => {
    pushMockRows([]);
    const result = await searchByChannelId("ch-1", "nonexistent");
    expect(result).toEqual([]);
  });
});

describe("findRecentTitles", () => {
  test("returns array of titles", async () => {
    pushMockRows([{ title: "Video 1" }, { title: "Video 2" }]);
    const result = await findRecentTitles("ch-1");
    expect(result).toEqual(["Video 1", "Video 2"]);
  });

  test("returns empty array when no videos", async () => {
    pushMockRows([]);
    const result = await findRecentTitles("ch-1");
    expect(result).toEqual([]);
  });
});

describe("countByChannelId", () => {
  test("returns count", async () => {
    pushMockRows([{ cnt: 42 }]);
    const result = await countByChannelId("ch-1");
    expect(result).toBe(42);
  });
});

describe("getMaxViewCount", () => {
  test("returns max view count", async () => {
    pushMockRows([{ max_views: 100000 }]);
    const result = await getMaxViewCount("ch-1");
    expect(result).toBe(100000);
  });
});

describe("findNewSince", () => {
  test("returns videos since date", async () => {
    pushMockRows([sampleVideo]);
    const result = await findNewSince("ch-1", new Date("2024-01-01"));
    expect(result.length).toBe(1);
  });
});

describe("findWithViewVelocity", () => {
  test("returns videos with velocity", async () => {
    pushMockRows([{ ...sampleVideo, view_velocity: 500 }]);
    const result = await findWithViewVelocity("ch-1", new Date("2024-01-01"));
    expect(result.length).toBe(1);
  });
});

describe("findNewSinceWithSummaries", () => {
  test("returns videos with summaries", async () => {
    pushMockRows([{ ...sampleVideo, summary: "A test summary" }]);
    const result = await findNewSinceWithSummaries("ch-1", new Date("2024-01-01"));
    expect(result.length).toBe(1);
  });
});

describe("sanitizeTags", () => {
  test("lowercases and trims tags", () => {
    expect(sanitizeTags(["React", " TypeScript ", "CSS"])).toEqual(["react", "typescript", "css"]);
  });

  test("removes duplicates", () => {
    expect(sanitizeTags(["react", "React", "REACT"])).toEqual(["react"]);
  });

  test("strips surrounding quotes", () => {
    expect(sanitizeTags(['"react"', "'hooks'"])).toEqual(["react", "hooks"]);
  });

  test("filters empty and overly long tags", () => {
    const longTag = "a".repeat(51);
    expect(sanitizeTags(["", "  ", longTag, "valid"])).toEqual(["valid"]);
  });

  test("limits to 10 tags", () => {
    const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    expect(sanitizeTags(tags).length).toBe(10);
  });
});
