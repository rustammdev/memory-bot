import { describe, test, expect } from "bun:test";
import { PERSONA_MAP, buildPersona } from "../persona";
import { CHANNEL_CATEGORIES } from "../../../lib/enums";
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
  overview: "A technology channel about TypeScript and React",
  associated_video_types: "tutorials, live coding, reviews",
  category: "technology",
  language: "en",
  created_at: new Date(),
};

describe("PERSONA_MAP", () => {
  test("has entry for every category", () => {
    for (const category of CHANNEL_CATEGORIES) {
      const persona = PERSONA_MAP[category];
      expect(persona).toBeDefined();
      expect(typeof persona.tone).toBe("string");
      expect(typeof persona.style).toBe("string");
      expect(typeof persona.traits).toBe("string");
    }
  });

  test("technology persona is technical", () => {
    expect(PERSONA_MAP.technology.tone).toContain("technical");
  });

  test("education persona is patient", () => {
    expect(PERSONA_MAP.education.tone).toContain("patient");
  });

  test("entertainment persona is fun", () => {
    expect(PERSONA_MAP.entertainment.tone).toContain("fun");
  });
});

describe("buildPersona", () => {
  test("includes tone, style, and traits", () => {
    const result = buildPersona(sampleMetadata, sampleChannel);
    expect(result).toContain("Tone: technical and precise");
    expect(result).toContain("Style:");
    expect(result).toContain("Traits:");
  });

  test("includes channel overview from metadata", () => {
    const result = buildPersona(sampleMetadata, sampleChannel);
    expect(result).toContain("Channel focus: A technology channel about TypeScript and React");
  });

  test("includes content formats from metadata", () => {
    const result = buildPersona(sampleMetadata, sampleChannel);
    expect(result).toContain("Content formats: tutorials, live coding, reviews");
  });

  test("includes audience stats", () => {
    const result = buildPersona(sampleMetadata, sampleChannel);
    expect(result).toContain("5.0K subscribers");
    expect(result).toContain("100 videos");
  });

  test("handles null metadata — defaults to 'other' category", () => {
    const result = buildPersona(null, sampleChannel);
    expect(result).toContain("Tone: helpful and adaptable");
  });

  test("handles metadata without overview", () => {
    const meta = { ...sampleMetadata, overview: null };
    const result = buildPersona(meta, sampleChannel);
    expect(result).not.toContain("Channel focus:");
  });

  test("handles metadata without associated_video_types", () => {
    const meta = { ...sampleMetadata, associated_video_types: null };
    const result = buildPersona(meta, sampleChannel);
    expect(result).not.toContain("Content formats:");
  });

  test("handles unknown category — falls back to 'other'", () => {
    const meta = { ...sampleMetadata, category: "nonexistent" };
    const result = buildPersona(meta, sampleChannel);
    expect(result).toContain("Tone: helpful and adaptable");
  });
});
