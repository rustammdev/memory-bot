import type { TranscriptSegment } from "../yt/fetch-transcript";

export interface Chunk {
  readonly index: number;
  readonly content: string;
  readonly startSec: number | null;
  readonly endSec: number | null;
}

const TARGET_CHARS = 1500;
const OVERLAP_CHARS = 100;
const SENTENCE_REGEX = /(?<=[.!?])\s+/;

/**
 * Chunk text with timestamp boundaries when segments are available.
 * Falls back to sentence-based splitting for plain text.
 */
export function chunkText(
  text: string,
  segments?: ReadonlyArray<TranscriptSegment> | null,
): ReadonlyArray<Chunk> {
  if (segments && segments.length > 0) {
    return chunkWithTimestamps(segments);
  }
  return chunkPlainText(text);
}

function chunkWithTimestamps(
  segments: ReadonlyArray<TranscriptSegment>,
): ReadonlyArray<Chunk> {
  if (segments.length === 0) return [];

  const chunks: Chunk[] = [];
  let current = "";
  let chunkStart = segments[0]!.startSec;
  let chunkEnd = segments[0]!.endSec;
  let chunkIndex = 0;

  for (const seg of segments) {
    const wouldExceed = current.length + seg.text.length + 1 > TARGET_CHARS;

    if (wouldExceed && current.length > 0) {
      chunks.push({
        index: chunkIndex,
        content: current.trim(),
        startSec: chunkStart,
        endSec: chunkEnd,
      });
      chunkIndex++;

      // Start new chunk — carry overlap from end of previous
      const overlapText = current.slice(-OVERLAP_CHARS);
      current = overlapText + " " + seg.text;
      chunkStart = seg.startSec;
      chunkEnd = seg.endSec;
    } else {
      current += (current ? " " : "") + seg.text;
      chunkEnd = seg.endSec;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({
      index: chunkIndex,
      content: current.trim(),
      startSec: chunkStart,
      endSec: chunkEnd,
    });
  }

  return chunks;
}

function chunkPlainText(text: string): ReadonlyArray<Chunk> {
  if (text.length <= TARGET_CHARS) {
    return [{ index: 0, content: text.trim(), startSec: null, endSec: null }];
  }

  const sentences = text.split(SENTENCE_REGEX);
  const chunks: Chunk[] = [];
  let current = "";
  let overlapBuffer = "";
  let chunkIndex = 0;

  for (const sentence of sentences) {
    if (current.length + sentence.length > TARGET_CHARS && current.length > 0) {
      chunks.push({ index: chunkIndex, content: current.trim(), startSec: null, endSec: null });
      chunkIndex++;
      overlapBuffer = current.slice(-OVERLAP_CHARS);
      current = overlapBuffer + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({ index: chunkIndex, content: current.trim(), startSec: null, endSec: null });
  }

  return chunks;
}
