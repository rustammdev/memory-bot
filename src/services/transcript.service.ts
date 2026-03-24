import { NotFoundError } from "../lib/errors";
import { requireParam } from "../lib/request";
import * as transcriptRepo from "../repositories/transcript.repo";
import * as videoRepo from "../repositories/video.repo";
import { summarizeTranscript } from "../ai/summarize";
import { fetchTranscript } from "../yt/fetch-transcript";

interface TranscriptResponse {
  readonly videoId: string;
  readonly language: string;
  readonly content: string;
  readonly summary: string | null;
  readonly createdAt: Date;
}

function toResponse(
  row: transcriptRepo.TranscriptRow,
  youtubeVideoId: string,
): TranscriptResponse {
  return {
    videoId: youtubeVideoId,
    language: row.language,
    content: row.content,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

async function resolveVideo(
  youtubeVideoId: string,
): Promise<videoRepo.VideoRow> {
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
    return {
      transcript: null,
      message: "Transcript not fetched yet. Use POST to fetch.",
    };
  }

  return { transcript: toResponse(transcript, youtubeVideoId) };
}

export async function fetchAndSaveTranscript(
  videoIdInput: string | null,
  language = "en",
): Promise<TranscriptResponse> {
  const youtubeVideoId = requireParam(videoIdInput, "videoId");
  const video = await resolveVideo(youtubeVideoId);

  const raw = await fetchTranscript(youtubeVideoId, language);
  const summary = await summarizeTranscript(video.title, raw.text);

  const saved = await transcriptRepo.upsert({
    videoId: video.id,
    content: raw.text,
    summary,
    language: raw.language,
  });

  return toResponse(saved, youtubeVideoId);
}
