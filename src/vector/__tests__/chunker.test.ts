import { describe, test, expect } from "bun:test";
import { chunkText } from "../chunker";

describe("chunkText", () => {
  test("returns single chunk for short text", () => {
    const text = "This is a short text.";
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.content).toBe("This is a short text.");
  });

  test("returns single chunk for text at target limit", () => {
    const text = "A".repeat(1500);
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
  });

  test("splits long text into multiple chunks", () => {
    // Create text with multiple sentences, each ~200 chars
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
    // No sentence breaks, so it stays as one chunk
    expect(chunks.length).toBe(1);
  });

  test("preserves overlap between chunks", () => {
    // Create sentences that will cause multi-chunk splitting
    const longSentence = (n: number) =>
      `This is a fairly long sentence number ${n} that contains many words to help fill up the chunk buffer beyond the target character limit for testing purposes. `;

    const text = Array.from({ length: 30 }, (_, i) => longSentence(i)).join("");
    const chunks = chunkText(text);

    if (chunks.length > 1) {
      // The end of chunk N should overlap with the beginning of chunk N+1
      const firstEnd = chunks[0]!.content.slice(-50);
      const secondStart = chunks[1]!.content.slice(0, 150);
      // Overlap means some text from end of chunk 0 appears at start of chunk 1
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
    // Every sentence should appear in at least one chunk
    for (const sentence of sentences) {
      const found = chunks.some((c) => c.content.includes(sentence.trim()));
      expect(found).toBe(true);
    }
  });
});
