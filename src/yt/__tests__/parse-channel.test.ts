import { describe, test, expect } from "bun:test";
import { extractUsername, toChannelUrl } from "../parse-channel";

describe("extractUsername", () => {
  test("adds @ prefix to plain username", () => {
    expect(extractUsername("CalebWritesCode")).toBe("@CalebWritesCode");
  });

  test("preserves @ prefix if already present", () => {
    expect(extractUsername("@CalebWritesCode")).toBe("@CalebWritesCode");
  });

  test("extracts username from YouTube URL", () => {
    expect(extractUsername("https://www.youtube.com/@CalebWritesCode")).toBe(
      "@CalebWritesCode",
    );
  });

  test("extracts username from YouTube URL with path", () => {
    expect(
      extractUsername("https://www.youtube.com/@CalebWritesCode/videos"),
    ).toBe("@CalebWritesCode");
  });

  test("trims whitespace", () => {
    expect(extractUsername("  CalebWritesCode  ")).toBe("@CalebWritesCode");
  });

  test("handles URL without @ sign", () => {
    const url = "https://www.youtube.com/channel/UC123";
    expect(extractUsername(url)).toBe(url.trim());
  });
});

describe("toChannelUrl", () => {
  test("converts plain username to URL", () => {
    expect(toChannelUrl("CalebWritesCode")).toBe(
      "https://www.youtube.com/@CalebWritesCode/videos",
    );
  });

  test("converts @username to URL", () => {
    expect(toChannelUrl("@CalebWritesCode")).toBe(
      "https://www.youtube.com/@CalebWritesCode/videos",
    );
  });

  test("appends /videos to URL without it", () => {
    expect(toChannelUrl("https://www.youtube.com/@CalebWritesCode")).toBe(
      "https://www.youtube.com/@CalebWritesCode/videos",
    );
  });

  test("keeps URL that already has /videos", () => {
    expect(
      toChannelUrl("https://www.youtube.com/@CalebWritesCode/videos"),
    ).toBe("https://www.youtube.com/@CalebWritesCode/videos");
  });

  test("removes trailing slashes from URL", () => {
    expect(toChannelUrl("https://www.youtube.com/@CalebWritesCode/")).toBe(
      "https://www.youtube.com/@CalebWritesCode/videos",
    );
  });
});
