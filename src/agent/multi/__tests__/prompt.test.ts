import { describe, test, expect } from "bun:test";
import { buildMultiChannelPrompt } from "../prompt";

describe("buildMultiChannelPrompt", () => {
  const channels = [
    { name: "Fireship", username: "@Fireship", category: "technology" },
    { name: "3Blue1Brown", username: "@3blue1brown", category: "education" },
  ];

  test("includes all channel names", () => {
    const prompt = buildMultiChannelPrompt(channels);
    expect(prompt).toContain("Fireship");
    expect(prompt).toContain("3Blue1Brown");
  });

  test("includes channel handles", () => {
    const prompt = buildMultiChannelPrompt(channels);
    expect(prompt).toContain("@Fireship");
    expect(prompt).toContain("@3blue1brown");
  });

  test("includes categories", () => {
    const prompt = buildMultiChannelPrompt(channels);
    expect(prompt).toContain("technology");
    expect(prompt).toContain("education");
  });

  test("includes multi-channel role description", () => {
    const prompt = buildMultiChannelPrompt(channels);
    expect(prompt).toContain("multi-channel YouTube analyst");
  });

  test("includes tool descriptions", () => {
    const prompt = buildMultiChannelPrompt(channels);
    expect(prompt).toContain("cross_channel_search");
    expect(prompt).toContain("list_channel_videos");
    expect(prompt).toContain("get_transcript");
    expect(prompt).toContain("get_channel_overview");
  });

  test("includes reasoning framework", () => {
    const prompt = buildMultiChannelPrompt(channels);
    expect(prompt).toContain("How to Think");
    expect(prompt).toContain("Step 1");
  });

  test("handles single channel", () => {
    const prompt = buildMultiChannelPrompt([channels[0]!]);
    expect(prompt).toContain("Fireship");
    expect(prompt).not.toContain("3Blue1Brown");
  });

  test("injects memory context when provided", () => {
    const prompt = buildMultiChannelPrompt(channels, {
      memories: "1. User compared React tutorials before",
      userProfile: "- Topics they've asked about: react, typescript",
    });
    expect(prompt).toContain("About This User");
    expect(prompt).toContain("react, typescript");
    expect(prompt).toContain("Past Conversations");
  });

  test("omits memory section when null", () => {
    const prompt = buildMultiChannelPrompt(channels, null);
    expect(prompt).not.toContain("About This User");
  });
});
