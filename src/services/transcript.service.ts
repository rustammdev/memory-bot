import { NotFoundError } from "../lib/errors";
import { requireParam } from "../lib/request";
import { createLogger } from "../lib/logger";
import { processWithConcurrency } from "../lib/concurrency";
import * as transcriptRepo from "../repositories/transcript.repo";
import * as videoRepo from "../repositories/video.repo";
import { summarizeTranscript } from "../ai/summarize";
import { fetchTranscript } from "../yt/fetch-transcript";
import { ingestTranscript } from "../vector/ingest";
import { requireChannel } from "./channel.helpers";

const log = createLogger("transcript");

const BATCH_CONCURRENCY = 3;

interface TranscriptResponse {
  readonly videoId: string;
  readonly language: string;
  readonly content: string;
  readonly summary: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly vectorized: boolean;
  readonly createdAt: Date;
}

export interface BatchResult {
  readonly videoId: string;
  readonly title: string;
  readonly status: "ok" | "skipped" | "error";
  readonly summary?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly error?: string;
}

export interface BatchOptions {
  readonly language?: string;
  readonly force?: boolean;
  readonly limit?: number;
  readonly videoIds?: ReadonlyArray<string>;
}

export type OnBatchResult = (result: BatchResult) => void;

function toResponse(
  row: transcriptRepo.TranscriptRow,
  youtubeVideoId: string,
  tags: ReadonlyArray<string>,
): TranscriptResponse {
  return {
    videoId: youtubeVideoId,
    language: row.language,
    content: row.content,
    summary: row.summary,
    tags,
    vectorized: row.vectorized,
    createdAt: row.created_at,
  };
}

async function resolveVideo(youtubeVideoId: string): Promise<videoRepo.VideoRow> {
  const video = await videoRepo.findByYoutubeVideoId(youtubeVideoId);
  if (!video) {
    throw new NotFoundError(
      `Video "${youtubeVideoId}" not found. Sync the channel first.`,
    );
  }
  return video;
}

export async function getTranscript(
  videoIdInput: string | null,
  language = "en",
): Promise<{ transcript: TranscriptResponse | null; message?: string }> {
  const youtubeVideoId = requireParam(videoIdInput, "videoId");
  const video = await resolveVideo(youtubeVideoId);

  const transcript = await transcriptRepo.findByVideoId(video.id, language);
  if (!transcript) {
    return { transcript: null, message: "Transcript not fetched yet. Use POST to fetch." };
  }

  return { transcript: toResponse(transcript, youtubeVideoId, video.tags) };
}

export async function fetchAndSaveTranscript(
  videoIdInput: string | null,
  language = "en",
  force = false,
): Promise<TranscriptResponse> {
  const youtubeVideoId = requireParam(videoIdInput, "videoId");
  const video = await resolveVideo(youtubeVideoId);

  if (!force) {
    const existing = await transcriptRepo.findByVideoId(video.id, language);
    if (existing) {
      log.info(`cache hit`, { videoId: youtubeVideoId });
      return toResponse(existing, youtubeVideoId, video.tags);
    }
  }

  const done = log.time(`fetch+save [${youtubeVideoId}]`);
  const raw = await fetchTranscript(youtubeVideoId, language);
  const { summary, tags } = await summarizeTranscript(video.title, raw.text);

  const [saved, maxViews] = await Promise.all([
    transcriptRepo.upsert({
      videoId: video.id,
      content: raw.text,
      segments: raw.segments,
      summary,
      language: raw.language,
    }),
    videoRepo.getMaxViewCount(video.channel_id),
  ]);

  await videoRepo.updateTags(video.id, tags);

  const importance = maxViews > 0 ? video.view_count / maxViews : 0;
  ingestTranscript({
    channelId: video.channel_id,
    videoId: video.id,
    transcriptId: saved.id,
    content: raw.text,
    segments: raw.segments,
    importance,
  })
    .catch((err) => {
      log.error(`vectorize/knowledge failed`, { transcriptId: saved.id, err: String(err) });
    });

  done();
  return toResponse(saved, youtubeVideoId, tags);
}

export async function fetchAndSaveBatch(
  channelInput: string | null,
  options: BatchOptions,
  onResult?: OnBatchResult,
): Promise<{ total: number; succeeded: number; failed: number; skipped: number }> {
  const { language = "en", force = false, limit = 20, videoIds } = options;
  const channel = await requireChannel(channelInput);

  let toProcess: ReadonlyArray<videoRepo.VideoRow>;
  let skippedVideos: ReadonlyArray<videoRepo.VideoRow> = [];

  if (videoIds && videoIds.length > 0) {
    // Manual selection: fetch requested videos, skip already transcribed
    const all = await videoRepo.findByYoutubeVideoIds(channel.id, videoIds);
    if (force) {
      toProcess = all;
    } else {
      const transcribedIds = await transcriptRepo.findTranscribedVideoIds(channel.id);
      skippedVideos = all.filter((v) => transcribedIds.has(v.id));
      toProcess = all.filter((v) => !transcribedIds.has(v.id));
    }
  } else if (force) {
    // Force mode: process latest N videos regardless of transcription status
    toProcess = await videoRepo.findLatestByChannel(channel.id, limit);
  } else {
    // Default: only untranscribed videos, latest first — single efficient query
    toProcess = await videoRepo.findUntranscribedByChannel(channel.id, limit, language);
  }

  // Emit skipped events immediately
  for (const v of skippedVideos) {
    const skipped: BatchResult = { videoId: v.youtube_video_id, title: v.title, status: "skipped" };
    onResult?.(skipped);
  }

  return runBatch(toProcess, language, force, skippedVideos.length, onResult);
}

async function runBatch(
  videos: ReadonlyArray<videoRepo.VideoRow>,
  language: string,
  force: boolean,
  skipped: number,
  onResult?: OnBatchResult,
): Promise<{ total: number; succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0;
  let failed = 0;

  await processWithConcurrency(videos, BATCH_CONCURRENCY, async (video) => {
    let result: BatchResult;
    try {
      const transcript = await fetchAndSaveTranscript(video.youtube_video_id, language, force);
      result = {
        videoId: video.youtube_video_id,
        title: video.title,
        status: "ok",
        summary: transcript.summary ?? undefined,
        tags: transcript.tags,
      };
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = { videoId: video.youtube_video_id, title: video.title, status: "error", error: message };
      failed++;
      log.warn(`batch: failed ${video.youtube_video_id}`, { error: message });
    }
    onResult?.(result);
  });

  return { total: videos.length + skipped, succeeded, failed, skipped };
}
