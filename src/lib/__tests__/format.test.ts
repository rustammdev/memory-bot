import { describe, test, expect } from "bun:test";
import { formatCompactNumber, formatDuration, MAX_TRANSCRIPT_CHARS } from "../format";

describe("formatCompactNumber", () => {
  test("returns raw number below 1000", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(1)).toBe("1");
    expect(formatCompactNumber(999)).toBe("999");
  });

  test("formats thousands with K suffix", () => {
    expect(formatCompactNumber(1000)).toBe("1.0K");
    expect(formatCompactNumber(1500)).toBe("1.5K");
    expect(formatCompactNumber(999_999)).toBe("1000.0K");
  });

  test("formats millions with M suffix", () => {
    expect(formatCompactNumber(1_000_000)).toBe("1.0M");
    expect(formatCompactNumber(2_500_000)).toBe("2.5M");
    expect(formatCompactNumber(10_000_000)).toBe("10.0M");
  });

  test("handles boundary between K and M", () => {
    expect(formatCompactNumber(999_999)).toBe("1000.0K");
    expect(formatCompactNumber(1_000_000)).toBe("1.0M");
  });
});

describe("formatDuration", () => {
  test("returns formatted string when provided", () => {
    expect(formatDuration(120, "2:00")).toBe("2:00");
    expect(formatDuration(null, "1:30:00")).toBe("1:30:00");
  });

  test("returns unknown when no seconds and no formatted", () => {
    expect(formatDuration(null, null)).toBe("unknown");
    expect(formatDuration(0, null)).toBe("unknown");
  });

  test("formats seconds into mm:ss", () => {
    expect(formatDuration(65, null)).toBe("1:05");
    expect(formatDuration(3600, null)).toBe("60:00");
    expect(formatDuration(5, null)).toBe("0:05");
    expect(formatDuration(60, null)).toBe("1:00");
  });

  test("pads seconds with leading zero", () => {
    expect(formatDuration(61, null)).toBe("1:01");
    expect(formatDuration(9, null)).toBe("0:09");
  });
});

describe("MAX_TRANSCRIPT_CHARS", () => {
  test("is 8000", () => {
    expect(MAX_TRANSCRIPT_CHARS).toBe(8_000);
  });
});
