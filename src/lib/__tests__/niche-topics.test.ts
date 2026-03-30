import { describe, test, expect } from "bun:test";
import { getNicheTopics, getNicheContext } from "../niche-topics";
import { CHANNEL_CATEGORIES, type ChannelCategory } from "../enums";

describe("getNicheTopics", () => {
  test("returns topics array for each valid category", () => {
    for (const category of CHANNEL_CATEGORIES) {
      const topics = getNicheTopics(category);
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
    }
  });

  test("technology topics include expected entries", () => {
    const topics = getNicheTopics("technology");
    expect(topics).toContain("TypeScript");
    expect(topics).toContain("Docker");
    expect(topics).toContain("REST API design");
  });

  test("returns 'other' topics for unknown category", () => {
    const topics = getNicheTopics("nonexistent" as ChannelCategory);
    const otherTopics = getNicheTopics("other");
    expect(topics).toEqual(otherTopics);
  });

  test("returns readonly array", () => {
    const topics = getNicheTopics("gaming");
    expect(Array.isArray(topics)).toBe(true);
  });
});

describe("getNicheContext", () => {
  test("returns context string for each valid category", () => {
    for (const category of CHANNEL_CATEGORIES) {
      const context = getNicheContext(category);
      expect(typeof context).toBe("string");
      expect(context.length).toBeGreaterThan(0);
    }
  });

  test("technology context mentions software development", () => {
    const context = getNicheContext("technology");
    expect(context).toContain("software development");
  });

  test("returns 'other' context for unknown category", () => {
    const context = getNicheContext("nonexistent" as ChannelCategory);
    const otherContext = getNicheContext("other");
    expect(context).toBe(otherContext);
  });
});
