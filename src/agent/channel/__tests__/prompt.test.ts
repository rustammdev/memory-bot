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

  test("includes reasoning framework", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("How to Think");
    expect(prompt).toContain("Step 1");
    expect(prompt).toContain("Step 2");
    expect(prompt).toContain("Step 3");
    expect(prompt).toContain("Step 4");
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
    expect(prompt).toContain("high");
    expect(prompt).toContain("medium");
    expect(prompt).toContain("low");
    expect(prompt).toContain("Never fabricate");
  });

  test("includes proactive intelligence section", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("Proactive Intelligence");
  });

  test("includes response calibration", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("Response Calibration");
    expect(prompt).toContain("Quick factual");
    expect(prompt).toContain("Deep analysis");
  });

  test("includes when NOT to use tools section", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata);
    expect(prompt).toContain("When NOT to Use Tools");
  });

  test("handles null metadata", () => {
    const prompt = buildSystemPrompt(sampleChannel, null);
    expect(prompt).toContain("Test Channel");
    expect(prompt).toContain("other");
  });

  test("injects memory context when provided", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata, {
      memories: "1. User asked about React hooks before",
      userProfile: "- Apparent skill level: beginner",
    });
    expect(prompt).toContain("About This User");
    expect(prompt).toContain("beginner");
    expect(prompt).toContain("Past Conversations");
    expect(prompt).toContain("React hooks");
  });

  test("omits memory section when no memory", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata, null);
    expect(prompt).not.toContain("About This User");
    expect(prompt).not.toContain("Past Conversations");
  });

  test("omits memory section when memory is empty", () => {
    const prompt = buildSystemPrompt(sampleChannel, sampleMetadata, {
      memories: "",
      userProfile: "",
    });
    expect(prompt).not.toContain("About This User");
  });
});
