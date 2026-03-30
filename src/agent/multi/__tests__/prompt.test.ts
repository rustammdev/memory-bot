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

  test("includes reasoning instructions", () => {
    const prompt = buildMultiChannelPrompt(channels);
    expect(prompt).toContain("Reasoning");
    expect(prompt).toContain("THINK before acting");
  });

  test("handles single channel", () => {
    const prompt = buildMultiChannelPrompt([channels[0]!]);
    expect(prompt).toContain("Fireship");
    expect(prompt).not.toContain("3Blue1Brown");
  });
});
