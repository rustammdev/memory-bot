import { ExternalServiceError } from "../lib/errors";
import { chunkText } from "./chunker";
import { embedTexts } from "./embedder";
import { insertChunks } from "./store";
import type { TranscriptSegment } from "../yt/fetch-transcript";

export interface IngestParams {
  readonly channelId: string;
  readonly videoId: string;
  readonly transcriptId: string;
  readonly content: string;
  readonly segments?: ReadonlyArray<TranscriptSegment> | null;
  readonly importance: number;
}

export async function ingestTranscript(params: IngestParams): Promise<void> {
  const chunks = chunkText(params.content, params.segments);
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(chunks.map((c) => c.content));

  if (embeddings.length !== chunks.length) {
    throw new ExternalServiceError(
      "OpenAI",
      `Expected ${chunks.length} embeddings, got ${embeddings.length}`,
    );
  }

  await insertChunks(
    chunks.map((chunk, i) => ({
      channelId: params.channelId,
      videoId: params.videoId,
      transcriptId: params.transcriptId,
      chunkIndex: chunk.index,
      content: chunk.content,
      embedding: embeddings[i]!,
      importance: params.importance,
      startSec: chunk.startSec,
    })),
    params.transcriptId,
  );
}
