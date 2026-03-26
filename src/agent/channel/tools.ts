import { tool } from "langchain";
import { z } from "zod";
import * as videoRepo from "../../repositories/video.repo";
import * as metadataRepo from "../../repositories/metadata.repo";
import * as digestRepo from "../../repositories/digest.repo";
import * as gapRepo from "../../repositories/content-gap.repo";
import { searchByChannelId } from "../../services/search.service";
import { createLogger } from "../../lib/logger";
import { formatCompactNumber, formatDuration } from "../../lib/format";
import { fetchTranscriptContent } from "../transcript";

const log = createLogger("agent-tool");

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
            `${i + 1}. "${v.title}" (${formatCompactNumber(v.view_count)} views, ${formatDuration(v.duration_sec, v.duration_formatted)}) [${v.youtube_video_id}]`,
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
        return await fetchTranscriptContent(videoId);
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

  const getLatestDigest = tool(
    async () => {
      const done = log.time("get_latest_digest");
      try {
        const digest = await digestRepo.findLatest(channelId);
        if (!digest || !digest.summary) {
          return "No digest has been generated for this channel yet. Suggest the user generate one via the API.";
        }

        const highlights = (digest.highlights ?? [])
          .map((h, i) => `${i + 1}. "${h.title}" — ${h.reason} (${(h.viewVelocity ?? 0).toFixed(0)} views/day)`)
          .join("\n");

        const topics = (digest.topic_clusters ?? [])
          .map((t) => `- ${t.topic}: ${t.description}`)
          .join("\n");

        const dateOpts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
        const period = `${digest.period_start.toLocaleDateString("en-US", dateOpts)} - ${digest.period_end.toLocaleDateString("en-US", dateOpts)}`;

        return [
          `Weekly Digest (${period}): ${digest.new_video_count} new videos`,
          `\nSummary: ${digest.summary}`,
          highlights ? `\nTop Highlights:\n${highlights}` : "",
          topics ? `\nTopic Clusters:\n${topics}` : "",
          digest.trend_analysis ? `\nTrend Analysis: ${digest.trend_analysis}` : "",
        ].filter(Boolean).join("\n");
      } finally {
        done();
      }
    },
    {
      name: "get_latest_digest",
      description:
        "Get the latest weekly digest — a smart summary of recent content including new videos, trending content, and trend analysis. Use when the user asks what's new, what changed recently, or wants a channel update.",
      schema: z.object({}),
    },
  );

  const findContentGaps = tool(
    async ({ limit }) => {
      const done = log.time("find_content_gaps");
      try {
        const result = await gapRepo.findLatest(channelId);
        if (!result) {
          return "Content gap analysis is not available yet. The channel needs transcripts to be fetched and vectorized first. Suggest using POST /api/channels/content-gaps to run the analysis.";
        }

        const gaps = (result.gaps as ReadonlyArray<gapRepo.ContentGap>).slice(0, limit);
        const lines = gaps.map(
          (g, i) =>
            `${i + 1}. **${g.topic}** (priority: ${g.priority}/100, confidence: ${g.confidence})\n   ${g.reason}\n   Suggested: "${g.suggestedVideoTitle}"\n   Angle: ${g.suggestedAngle}`,
        );

        const topicCount = (result.topics_covered as ReadonlyArray<gapRepo.CoveredTopic>).length;
        return `Content Gap Analysis (${result.total_videos_analyzed} videos, ${topicCount} topics identified):\n\n${result.summary}\n\n## Top ${gaps.length} Content Gaps:\n\n${lines.join("\n\n")}`;
      } finally {
        done();
      }
    },
    {
      name: "find_content_gaps",
      description:
        "Find topics this channel HASN'T covered yet but SHOULD. Returns ranked content gap opportunities with video suggestions. Use when asked about content ideas, missing topics, or 'what should they make next?'.",
      schema: z.object({
        limit: z.number().min(1).max(15).default(5).describe("Maximum gaps to return"),
      }),
    },
  );

  return [listVideos, getTranscript, semanticSearch, getChannelInfo, getLatestDigest, findContentGaps];
}
