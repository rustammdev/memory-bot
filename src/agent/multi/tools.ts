import { tool } from "langchain";
import { z } from "zod";
import * as videoRepo from "../../repositories/video.repo";
import { searchAcrossChannels } from "../../services/search.service";
import { createLogger } from "../../lib/logger";
import { formatCompactNumber, formatDuration } from "../../lib/format";
import { fetchTranscriptContent } from "../transcript";
import type { ChannelRow } from "../../repositories/channel.repo";
import type { MetadataRow } from "../../repositories/metadata.repo";

const log = createLogger("multi-agent-tool");

interface MultiToolContext {
  readonly channelIds: ReadonlyArray<string>;
  readonly channelsByUsername: ReadonlyMap<string, ChannelRow>;
  readonly metadataByChannelId: ReadonlyMap<string, MetadataRow | null>;
}

export function createMultiChannelTools(ctx: MultiToolContext) {
  const crossChannelSearch = tool(
    async ({ query, limit }) => {
      const done = log.time(`cross_channel_search q="${query}"`);
      try {
        const results = await searchAcrossChannels(ctx.channelIds, query, limit);

        if (results.length === 0) {
          return "No relevant content found across any of the channels.";
        }

        const grouped = new Map<string, typeof results>();
        for (const r of results) {
          const existing = grouped.get(r.channelName) ?? [];
          grouped.set(r.channelName, [...existing, r]);
        }

        const sections: string[] = [];
        for (const [channelName, items] of grouped) {
          const lines = items.map(
            (r, i) =>
              `  ${i + 1}. [${r.videoTitle}](${r.videoUrl}) (similarity: ${(r.similarity * 100).toFixed(1)}%)\n     "${r.content.slice(0, 250)}..."`,
          );
          sections.push(`**${channelName}:**\n${lines.join("\n")}`);
        }

        return `Found ${results.length} relevant segments across ${grouped.size} channels:\n\n${sections.join("\n\n")}`;
      } finally {
        done();
      }
    },
    {
      name: "cross_channel_search",
      description:
        "Search across ALL available channels by meaning. Returns relevant transcript excerpts grouped by channel with similarity scores. Use as the FIRST tool when comparing how different channels cover a topic.",
      schema: z.object({
        query: z
          .string()
          .describe("The search query — describe the topic you want to find"),
        limit: z
          .number()
          .min(1)
          .max(20)
          .default(10)
          .describe("Maximum total results across all channels"),
      }),
    },
  );

  const listChannelVideos = tool(
    async ({ channel, query, limit }) => {
      const done = log.time(`list_channel_videos ch="${channel}"`);
      try {
        const ch = ctx.channelsByUsername.get(channel);
        if (!ch) return `Channel "@${channel}" is not in the available channels.`;

        const videos = await videoRepo.searchByChannelId(ch.id, query, limit);
        if (videos.length === 0) {
          return `No videos found in @${channel} matching the criteria.`;
        }

        const lines = videos.map(
          (v, i) =>
            `${i + 1}. "${v.title}" (${formatCompactNumber(v.view_count)} views, ${formatDuration(v.duration_sec, v.duration_formatted)}) [${v.youtube_video_id}]`,
        );
        return `@${channel} — ${videos.length} videos:\n${lines.join("\n")}`;
      } finally {
        done();
      }
    },
    {
      name: "list_channel_videos",
      description:
        "Browse or search a specific channel's video library by name. Returns titles, view counts, durations, and YouTube video IDs. Use when you need to drill into one channel's content.",
      schema: z.object({
        channel: z
          .string()
          .describe("The channel handle/username (e.g. 'Fireship')"),
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
        return await fetchTranscriptContent(videoId);
      } finally {
        done();
      }
    },
    {
      name: "get_transcript",
      description:
        "Read the full transcript and AI-generated summary of a specific video. Requires a YouTube video ID — call list_channel_videos first if you don't have one.",
      schema: z.object({
        videoId: z
          .string()
          .describe(
            "The YouTube video ID (e.g. 'dQw4w9WgXcQ'), found in list_channel_videos output",
          ),
      }),
    },
  );

  const getChannelOverview = tool(
    async ({ channel }) => {
      const done = log.time(`get_channel_overview ch="${channel}"`);
      try {
        const ch = ctx.channelsByUsername.get(channel);
        if (!ch) return `Channel "@${channel}" is not in the available channels.`;

        const metadata = ctx.metadataByChannelId.get(ch.id) ?? null;
        if (!metadata) {
          return `@${channel} (${ch.name}): metadata has not been generated yet. ${formatCompactNumber(ch.followers)} subscribers, ${ch.video_count} videos.`;
        }

        return [
          `@${channel} (${ch.name}):`,
          `Overview: ${metadata.overview}`,
          `Video types: ${metadata.associated_video_types}`,
          `Category: ${metadata.category}`,
          `Language: ${metadata.language}`,
          `Stats: ${formatCompactNumber(ch.followers)} subscribers, ${ch.video_count} videos`,
        ].join("\n");
      } finally {
        done();
      }
    },
    {
      name: "get_channel_overview",
      description:
        "Get a specific channel's overview: what it covers, content types, category, language, and stats. Use when comparing what different channels are about.",
      schema: z.object({
        channel: z
          .string()
          .describe("The channel handle/username (e.g. 'Fireship')"),
      }),
    },
  );

  return [crossChannelSearch, listChannelVideos, getTranscript, getChannelOverview];
}
