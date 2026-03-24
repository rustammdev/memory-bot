export interface Chunk {
  readonly index: number;
  readonly content: string;
}

const TARGET_CHARS = 1500;
const OVERLAP_CHARS = 100;
const SENTENCE_REGEX = /(?<=[.!?])\s+/;

export function chunkText(text: string): ReadonlyArray<Chunk> {
  if (text.length <= TARGET_CHARS) {
    return [{ index: 0, content: text.trim() }];
  }

  const sentences = text.split(SENTENCE_REGEX);
  const chunks: Chunk[] = [];
  let current = "";
  let overlapBuffer = "";
  let chunkIndex = 0;

  for (const sentence of sentences) {
    if (current.length + sentence.length > TARGET_CHARS && current.length > 0) {
      chunks.push({ index: chunkIndex, content: current.trim() });
      chunkIndex++;
      overlapBuffer = current.slice(-OVERLAP_CHARS);
      current = overlapBuffer + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  if (current.trim().length > 0) {
    chunks.push({ index: chunkIndex, content: current.trim() });
  }

  return chunks;
}
