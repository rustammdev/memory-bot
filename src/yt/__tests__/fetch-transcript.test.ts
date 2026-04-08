import { describe, test, expect } from "bun:test";

// We can't test fetchTranscript (needs yt-dlp), but we can test parseVtt
// by importing the module and testing indirectly through exported types.
// Since parseVtt is not exported, we test the segment extraction logic directly.

// Simulating parseVtt logic for testing
function parseVtt(raw: string) {
  const TIMESTAMP_RE = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;

  function parseTimestamp(h: string, m: string, s: string, ms: string): number {
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  }

  const lines = raw.split("\n");
  const segments: Array<{ startSec: number; endSec: number; text: string }> = [];
  const textLines: string[] = [];
  let currentStart = -1;
  let currentEnd = -1;
  let currentLines: string[] = [];
  let prevText = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed === "WEBVTT" || trimmed.startsWith("Kind:") || trimmed.startsWith("Language:")) {
      if (currentStart >= 0 && currentLines.length > 0) {
        const text = currentLines.join(" ");
        if (text !== prevText) {
          segments.push({ startSec: currentStart, endSec: currentEnd, text });
          textLines.push(text);
          prevText = text;
        }
        currentLines = [];
        currentStart = -1;
      }
      continue;
    }

    const tsMatch = trimmed.match(TIMESTAMP_RE);
    if (tsMatch) {
      if (currentStart >= 0 && currentLines.length > 0) {
        const text = currentLines.join(" ");
        if (text !== prevText) {
          segments.push({ startSec: currentStart, endSec: currentEnd, text });
          textLines.push(text);
          prevText = text;
        }
        currentLines = [];
      }
      currentStart = parseTimestamp(tsMatch[1]!, tsMatch[2]!, tsMatch[3]!, tsMatch[4]!);
      currentEnd = parseTimestamp(tsMatch[5]!, tsMatch[6]!, tsMatch[7]!, tsMatch[8]!);
      continue;
    }

    const cleaned = trimmed.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    if (cleaned !== "") currentLines.push(cleaned);
  }

  if (currentStart >= 0 && currentLines.length > 0) {
    const text = currentLines.join(" ");
    if (text !== prevText) {
      segments.push({ startSec: currentStart, endSec: currentEnd, text });
      textLines.push(text);
    }
  }

  return { text: textLines.join(" "), segments };
}

describe("VTT parsing with timestamps", () => {
  test("extracts segments with start and end times", () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

00:00:00.500 --> 00:00:07.000
Hello everyone, welcome to the tutorial.

00:00:07.000 --> 00:00:11.000
Today we're going to learn about React hooks.

00:00:11.000 --> 00:00:18.500
Hooks were introduced in React 16.8.
`;

    const result = parseVtt(vtt);

    expect(result.segments.length).toBe(3);
    expect(result.segments[0]!.startSec).toBe(0.5);
    expect(result.segments[0]!.endSec).toBe(7);
    expect(result.segments[0]!.text).toBe("Hello everyone, welcome to the tutorial.");
    expect(result.segments[1]!.startSec).toBe(7);
    expect(result.segments[2]!.startSec).toBe(11);
    expect(result.segments[2]!.endSec).toBe(18.5);
  });

  test("produces concatenated text from all segments", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
First sentence.

00:00:05.000 --> 00:00:10.000
Second sentence.
`;

    const result = parseVtt(vtt);
    expect(result.text).toBe("First sentence. Second sentence.");
  });

  test("deduplicates consecutive identical lines", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Same text here.

00:00:03.000 --> 00:00:06.000
Same text here.

00:00:06.000 --> 00:00:09.000
Different text now.
`;

    const result = parseVtt(vtt);
    expect(result.segments.length).toBe(2);
    expect(result.segments[0]!.text).toBe("Same text here.");
    expect(result.segments[1]!.text).toBe("Different text now.");
  });

  test("strips HTML tags from captions", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
<c.colorE5E5E5>Hello</c> <c.colorCCCCCC>world</c>
`;

    const result = parseVtt(vtt);
    expect(result.segments[0]!.text).toBe("Hello world");
  });

  test("handles hour-long timestamps", () => {
    const vtt = `WEBVTT

01:23:45.678 --> 01:24:00.000
This is far into the video.
`;

    const result = parseVtt(vtt);
    expect(result.segments[0]!.startSec).toBeCloseTo(5025.678, 2);
  });

  test("handles empty VTT", () => {
    const vtt = `WEBVTT
Kind: captions
Language: en
`;

    const result = parseVtt(vtt);
    expect(result.segments.length).toBe(0);
    expect(result.text).toBe("");
  });

  test("handles multi-line captions within a segment", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:10.000
First line of caption
Second line of caption
`;

    const result = parseVtt(vtt);
    expect(result.segments[0]!.text).toBe("First line of caption Second line of caption");
  });
});
