import { createLogger } from "../lib/logger";
import * as knowledgeRepo from "../repositories/knowledge.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import * as buildRepo from "../repositories/knowledge-build.repo";
import { processVideo } from "./graph-builder";

const log = createLogger("graph-incremental");

export async function extractKnowledgeForVideo(
  channelId: string,
  videoId: string,
): Promise<void> {
  const done = log.time(`incremental [${videoId}]`);

  try {
    const alreadyProcessed = await buildRepo.findProcessedVideoIds(channelId);
    if (alreadyProcessed.has(videoId)) {
      log.info("video already processed, skipping", { videoId });
      done();
      return;
    }

    const chunks = await knowledgeRepo.findChunksByVideoId(channelId, videoId);
    if (chunks.length === 0) {
      log.info("no chunks found for video, skipping", { videoId });
      done();
      return;
    }

    const metadata = await metadataRepo.findLatest(channelId);
    const category = metadata?.category ?? "other";

    await processVideo(channelId, chunks, category);
    await buildRepo.markVideoProcessed(channelId, videoId);
    await knowledgeRepo.updateImportance(channelId);

    log.info("incremental extraction done", { videoId, chunks: chunks.length });
  } catch (err) {
    log.error("incremental extraction failed", {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    done();
  }
}
