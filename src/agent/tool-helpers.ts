import { tool } from "langchain";
import { z } from "zod";
import { createLogger } from "../lib/logger";
import { formatCompactNumber, formatDuration } from "../lib/format";
import { fetchTranscriptContent } from "./transcript";

const log = createLogger("agent-tool");

interface VideoListItem {
  readonly title: string;
  readonly view_count: number;
  readonly duration_sec: number | null;
  readonly duration_formatted: string | null;
  readonly youtube_video_id: string;
}

export function formatVideoLines(videos: ReadonlyArray<VideoListItem>): string[] {
  return videos.map(
    (v, i) =>
      `${i + 1}. **${v.title}** — ${formatCompactNumber(v.view_count)} views, ${formatDuration(v.duration_sec, v.duration_formatted)}\n   ID: \`${v.youtube_video_id}\``,
  );
}

export function createGetTranscriptTool(listToolName: string) {
  return tool(
    async ({ videoId }) => {
      const done = log.time(`get_transcript [${videoId}]`);
      try {
        return await fetchTranscriptContent(videoId);
      } finally {
        done();
      }
    },
    {
      name: "get_transcript",
      description: `Read the full transcript and AI-generated summary of a specific video. Use when the user wants detailed content from a particular video. Requires a YouTube video ID — call ${listToolName} first if you don't have one. Do NOT use for broad topic searches — use semantic_search or cross_channel_search instead.`,
      schema: z.object({
        videoId: z
          .string()
          .describe("The YouTube video ID (e.g. 'dQw4w9WgXcQ'), found in list_videos output"),
      }),
    },
  );
}
