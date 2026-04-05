import { describe, test, expect } from "bun:test";

import { requireChannelParam, toApiResponse } from "../channel.helpers";
import type { ChannelRow } from "../../repositories/channel.repo";
import type { VideoRow } from "../../repositories/video.repo";
import type { MetadataRow } from "../../repositories/metadata.repo";

const sampleChannel: ChannelRow = {
  id: "ch-1",
  youtube_id: "UC123",
  username: "@testchannel",
  name: "Test Channel",
  followers: 5000,
  video_count: 100,
  avatar_url: "https://img.youtube.com/avatar.jpg",
  banner_url: "https://img.youtube.com/banner.jpg",
  last_synced_at: new Date("2025-01-01"),
  created_at: new Date("2025-01-01"),
  updated_at: new Date("2025-01-01"),
};

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
  tags: ["typescript", "testing"],
  uploaded_at: new Date("2025-01-01"),
  synced_at: new Date("2025-01-01"),
  created_at: new Date("2025-01-01"),
};

const sampleMetadata: MetadataRow = {
  id: "m-1",
  channel_id: "ch-1",
  version: 1,
  overview: "A technology channel",
  associated_video_types: "tutorials, reviews",
  category: "technology",
  language: "en",
  created_at: new Date("2025-01-01"),
};

describe("requireChannelParam", () => {
  test("adds @ prefix to plain channel name", () => {
    expect(requireChannelParam("CalebWritesCode")).toBe("@CalebWritesCode");
  });

  test("preserves @ prefix", () => {
    expect(requireChannelParam("@CalebWritesCode")).toBe("@CalebWritesCode");
  });

  test("throws for null input", () => {
    expect(() => requireChannelParam(null)).toThrow();
  });

  test("throws for empty string", () => {
    expect(() => requireChannelParam("")).toThrow();
  });
});

describe("toApiResponse", () => {
  test("transforms channel + videos + metadata into API response", () => {
    const result = toApiResponse(sampleChannel, [sampleVideo], sampleMetadata);

    expect(result.channelName).toBe("Test Channel");
    expect(result.channelId).toBe("UC123");
    expect(result.handle).toBe("@testchannel");
    expect(result.avatarUrl).toBe("https://img.youtube.com/avatar.jpg");
    expect(result.bannerUrl).toBe("https://img.youtube.com/banner.jpg");
    expect(result.totalVideos).toBe(100);
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.version).toBe(1);
    expect(result.metadata!.category).toBe("technology");
    expect(result.videos.length).toBe(1);
    expect(result.videos[0]!.id).toBe("abc123");
    expect(result.videos[0]!.title).toBe("Test Video");
    expect(result.videos[0]!.viewCount).toBe(5000);
    expect(result.videos[0]!.tags).toEqual(["typescript", "testing"]);
  });

  test("handles null metadata", () => {
    const result = toApiResponse(sampleChannel, [sampleVideo], null);
    expect(result.metadata).toBeNull();
  });

  test("handles empty videos array", () => {
    const result = toApiResponse(sampleChannel, [], sampleMetadata);
    expect(result.videos).toEqual([]);
  });

  test("marks videos with transcript status", () => {
    const transcribedIds = new Set(["v-1"]);
    const result = toApiResponse(
      sampleChannel,
      [sampleVideo],
      null,
      transcribedIds,
    );
    expect(result.videos[0]!.hasTranscript).toBe(true);
  });

  test("marks videos without transcript", () => {
    const result = toApiResponse(sampleChannel, [sampleVideo], null);
    expect(result.videos[0]!.hasTranscript).toBe(false);
  });
});
