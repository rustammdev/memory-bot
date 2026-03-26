import * as videoRepo from "../repositories/video.repo";
import * as transcriptRepo from "../repositories/transcript.repo";
import { MAX_TRANSCRIPT_CHARS } from "../lib/format";

export async function fetchTranscriptContent(
  videoId: string,
): Promise<string> {
  const video = await videoRepo.findByYoutubeVideoId(videoId);
  if (!video) return `Video "${videoId}" not found in database.`;

  const transcript = await transcriptRepo.findByVideoId(video.id);
  if (!transcript) {
    return `Transcript for "${video.title}" has not been fetched yet.`;
  }

  const summary = transcript.summary
    ? `Summary: ${transcript.summary}\n\n`
    : "";

  const content =
    transcript.content.length > MAX_TRANSCRIPT_CHARS
      ? `${transcript.content.slice(0, MAX_TRANSCRIPT_CHARS)}... [truncated]`
      : transcript.content;

  return `${summary}Full transcript for "${video.title}":\n${content}`;
}
