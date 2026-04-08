import { describe, test, expect } from "bun:test";
import { buildSystemPrompt } from "../prompt";
import type { ChannelRow } from "../../../repositories/channel.repo";
import type { MetadataRow } from "../../../repositories/metadata.repo";

const sampleChannel: ChannelRow = {
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

const sampleMetadata: MetadataRow = {
  id: "m-1",
  channel_id: "ch-1",
  version: 1,
  overview: "A tech channel",
  associated_video_types: "tutorials",
  category: "technology",
  language: "en",
  created_at: new Date(),
};

describe("buildSystemPrompt", () => {
  test("includes channel name and handle", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("Test Channel");
    expect(prompt).toContain("@testchannel");
  });

  test("includes category", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("technology");
  });

  test("includes persona traits", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("Tone:");
    expect(prompt).toContain("Style:");
    expect(prompt).toContain("Traits:");
  });

  test("includes reasoning instructions", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("Reasoning");
    expect(prompt).toContain("THINK before acting");
  });

  test("includes tool descriptions", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("semantic_search");
    expect(prompt).toContain("list_videos");
    expect(prompt).toContain("get_transcript");
    expect(prompt).toContain("get_channel_info");
    expect(prompt).toContain("get_latest_digest");
    expect(prompt).toContain("find_content_gaps");
  });

  test("includes confidence section", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("Confidence");
    expect(prompt).toContain("high confidence");
    expect(prompt).toContain("medium confidence");
    expect(prompt).toContain("low confidence");
  });

  test("includes response style", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("Response Style");
    expect(prompt).toContain("user's language");
  });

  test("handles null metadata", () => {
    const prompt = buildSystemPrompt(sampleChannel, null);
    expect(prompt).toContain("Test Channel");
    expect(prompt).toContain("other"); // default category
  });
});
