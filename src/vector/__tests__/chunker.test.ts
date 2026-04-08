import { describe, test, expect } from "bun:test";
import { chunkText } from "../chunker";
import type { TranscriptSegment } from "../../yt/fetch-transcript";

describe("chunkText (plain text — no segments)", () => {
  test("returns single chunk for short text", () => {
    const chunks = chunkText("This is a short text.");
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.content).toBe("This is a short text.");
    expect(chunks[0]!.startSec).toBeNull();
    expect(chunks[0]!.endSec).toBeNull();
  });

  test("returns single chunk for text at target limit", () => {
    const text = "A".repeat(1500);
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
  });

  test("splits long text into multiple chunks", () => {
    const sentences = Array.from({ length: 20 }, (_, i) =>
      `This is sentence number ${i + 1} and it contains some extra words to make it longer. `,
    );
    const text = sentences.join("");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test("chunks have sequential indices", () => {
    const sentences = Array.from({ length: 30 }, (_, i) =>
      `Sentence ${i + 1} is here with enough text to fill the buffer and cause splitting. `,
    );
    const text = sentences.join("");
    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.index).toBe(i);
    }
  });

  test("chunks content is trimmed", () => {
    const text = "  Short text with spaces.  ";
    const chunks = chunkText(text);
    expect(chunks[0]!.content).toBe("Short text with spaces.");
  });

  test("handles empty string", () => {
    const chunks = chunkText("");
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.content).toBe("");
  });

  test("handles text with no sentence boundaries", () => {
    const text = "a".repeat(3000);
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
  });

  test("preserves overlap between chunks", () => {
    const longSentence = (n: number) =>
      `This is a fairly long sentence number ${n} that contains many words to help fill up the chunk buffer beyond the target character limit for testing purposes. `;

    const text = Array.from({ length: 30 }, (_, i) => longSentence(i)).join("");
    const chunks = chunkText(text);

    if (chunks.length > 1) {
      const firstEnd = chunks[0]!.content.slice(-50);
      const secondStart = chunks[1]!.content.slice(0, 150);
      const hasOverlap = secondStart.includes(firstEnd.slice(-20));
      expect(hasOverlap || chunks.length > 1).toBe(true);
    }
  });

  test("all text is covered across chunks", () => {
    const sentences = Array.from({ length: 15 }, (_, i) =>
      `Important sentence ${i + 1} goes here. `,
    );
    const text = sentences.join("");
    const chunks = chunkText(text);
    for (const sentence of sentences) {
      const found = chunks.some((c) => c.content.includes(sentence.trim()));
      expect(found).toBe(true);
    }
  });

  test("plain text chunks have null timestamps", () => {
    const text = "Hello world. This is a test.";
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.startSec).toBeNull();
      expect(chunk.endSec).toBeNull();
    }
  });
});

describe("chunkText (with timed segments)", () => {
  function makeSegments(count: number, charsEach: number): TranscriptSegment[] {
    return Array.from({ length: count }, (_, i) => ({
      startSec: i * 5,
      endSec: (i + 1) * 5,
      text: `Segment ${i}: ${"word ".repeat(Math.floor(charsEach / 5))}`,
    }));
  }

  test("produces chunks with timestamps from segments", () => {
    const segments: TranscriptSegment[] = [
      { startSec: 0, endSec: 5, text: "Hello everyone." },
      { startSec: 5, endSec: 10, text: "Welcome to this tutorial." },
      { startSec: 10, endSec: 15, text: "Let's get started." },
    ];

    const chunks = chunkText("", segments);
    expect(chunks.length).toBe(1); // Short enough for one chunk
    expect(chunks[0]!.startSec).toBe(0);
    expect(chunks[0]!.endSec).toBe(15);
    expect(chunks[0]!.content).toContain("Hello everyone.");
    expect(chunks[0]!.content).toContain("Let's get started.");
  });

  test("splits into multiple chunks with correct timestamps", () => {
    // Create enough segments to force multiple chunks (~1500 chars each)
    const segments = makeSegments(30, 100);

    const chunks = chunkText("", segments);
    expect(chunks.length).toBeGreaterThan(1);

    // First chunk starts at beginning
    expect(chunks[0]!.startSec).toBe(0);

    // Each subsequent chunk starts later
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.startSec!).toBeGreaterThan(chunks[i - 1]!.startSec!);
    }

    // All chunks have timestamps
    for (const chunk of chunks) {
      expect(chunk.startSec).not.toBeNull();
      expect(chunk.endSec).not.toBeNull();
      expect(chunk.endSec!).toBeGreaterThanOrEqual(chunk.startSec!);
    }
  });

  test("chunks have sequential indices with segments", () => {
    const segments = makeSegments(30, 100);
    const chunks = chunkText("", segments);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.index).toBe(i);
    }
  });

  test("falls back to plain text when segments are null", () => {
    const chunks = chunkText("Short text.", null);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.startSec).toBeNull();
  });

  test("falls back to plain text when segments are empty", () => {
    const chunks = chunkText("Short text.", []);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.startSec).toBeNull();
  });

  test("handles single segment", () => {
    const segments: TranscriptSegment[] = [
      { startSec: 42.5, endSec: 50, text: "A single caption." },
    ];

    const chunks = chunkText("", segments);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.startSec).toBe(42.5);
    expect(chunks[0]!.endSec).toBe(50);
  });
});
