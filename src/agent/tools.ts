import { tool } from "langchain";
import { z } from "zod";
import * as videoRepo from "../repositories/video.repo";
import * as transcriptRepo from "../repositories/transcript.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { searchByChannelId } from "../services/search.service";
import { createLogger } from "../lib/logger";

const log = createLogger("agent-tool");

const MAX_TRANSCRIPT_CHARS = 8_000;

function formatDuration(sec: number | null, formatted: string | null): string {
  if (formatted) return formatted;
  if (!sec) return "unknown";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function createChannelTools(channelId: string) {
  const listVideos = tool(
    async ({ query, limit }) => {
      const done = log.time(`list_videos query=${query ?? "*"}`);
      try {
        const videos = await videoRepo.searchByChannelId(channelId, query, limit);
        if (videos.length === 0) {
          return "No videos found matching the criteria.";
        }

        const lines = videos.map(
          (v, i) =>
            `${i + 1}. "${v.title}" (${formatViews(v.view_count)} views, ${formatDuration(v.duration_sec, v.duration_formatted)}) [${v.youtube_video_id}]`,
        );
        return `Found ${videos.length} videos:\n${lines.join("\n")}`;
      } finally {
        done();
      }
    },
    {
      name: "list_videos",
      description:
        "Browse or search this channel's video library. Use when the user asks what videos exist, wants to find a video by name, or needs a video ID for get_transcript. Do NOT use for topic-based questions — use semantic_search instead. Returns titles, view counts, durations, and YouTube video IDs.",
      schema: z.object({
        query: z
          .string()
          .optional()
          .describe("Optional keyword to filter video titles"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum number of videos to return"),
      }),
    },
  );

  const getTranscript = tool(
    async ({ videoId }) => {
      const done = log.time(`get_transcript [${videoId}]`);
      try {
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
      } finally {
        done();
      }
    },
    {
      name: "get_transcript",
      description:
        "Read the full transcript and AI-generated summary of a specific video. Use when the user wants detailed content from a particular video. Requires a YouTube video ID — call list_videos first if you don't have one. Do NOT use for broad topic searches across multiple videos — use semantic_search instead.",
      schema: z.object({
        videoId: z
          .string()
          .describe(
            "The YouTube video ID (e.g. 'dQw4w9WgXcQ'), found in list_videos output",
          ),
      }),
    },
  );

  const semanticSearch = tool(
    async ({ query, limit }) => {
      const done = log.time(`semantic_search q="${query}"`);
      try {
        const results = await searchByChannelId(channelId, query, limit);

        if (results.length === 0) {
          return "No relevant content found. Try a different query or check that transcripts have been fetched.";
        }

        const lines = results.map(
          (r, i) =>
            `${i + 1}. [${r.videoTitle}](${r.videoUrl}) (similarity: ${(r.similarity * 100).toFixed(1)}%)\n   "${r.content.slice(0, 300)}..."`,
        );
        return `Found ${results.length} relevant segments:\n\n${lines.join("\n\n")}`;
      } finally {
        done();
      }
    },
    {
      name: "semantic_search",
      description:
        "Search across all channel transcripts by meaning, not just keywords. Use as the FIRST tool when the user asks about a topic, concept, or question discussed in videos (e.g. 'what did they say about React hooks?'). Returns the most relevant transcript excerpts with video references. Do NOT use for browsing videos by title — use list_videos instead. Requires transcripts to have been fetched and vectorized.",
      schema: z.object({
        query: z.string().describe("The search query — describe what you want to find"),
        limit: z
          .number()
          .min(1)
          .max(10)
          .default(5)
          .describe("Maximum number of results"),
      }),
    },
  );

  const getChannelInfo = tool(
    async () => {
      const done = log.time("get_channel_info");
      try {
        const metadata = await metadataRepo.findLatest(channelId);
        if (!metadata) return "Channel metadata has not been generated yet.";

        return [
          `Overview: ${metadata.overview}`,
          `Video types: ${metadata.associated_video_types}`,
          `Category: ${metadata.category}`,
          `Language: ${metadata.language}`,
          `Metadata version: ${metadata.version}`,
        ].join("\n");
      } finally {
        done();
      }
    },
    {
      name: "get_channel_info",
      description:
        "Get a high-level overview of this channel: what it covers, content types, category, and primary language. Use when the user asks general questions like 'what is this channel about?' or 'what kind of content do they make?'. Do NOT use for specific video or topic questions.",
      schema: z.object({}),
    },
  );

  return [listVideos, getTranscript, semanticSearch, getChannelInfo];
}
