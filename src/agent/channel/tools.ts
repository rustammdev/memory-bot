import { tool } from "langchain";
import { z } from "zod";
import * as videoRepo from "../../repositories/video.repo";
import * as metadataRepo from "../../repositories/metadata.repo";
import * as digestRepo from "../../repositories/digest.repo";
import * as gapRepo from "../../repositories/content-gap.repo";
import * as knowledgeRepo from "../../repositories/knowledge.repo";
import { deduplicateByKey } from "../../lib/collection";
import { premiumSearch } from "../../services/search.service";
import { findLearningPathByChannelId, buildChannelGraphById } from "../../services/knowledge.service";
import { createLogger } from "../../lib/logger";
import { createGetTranscriptTool, formatVideoLines } from "../tool-helpers";

const log = createLogger("agent-tool");

function formatSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
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
        return `Found ${videos.length} videos:\n\n${formatVideoLines(videos).join("\n\n")}`;
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

  const getTranscript = createGetTranscriptTool("list_videos");

  const semanticSearch = tool(
    async ({ queries, limit }) => {
      const queryList = queries.length > 0 ? queries : [""];
      const done = log.time(`semantic_search queries=${queryList.length}`);
      try {
        // Run all queries in parallel
        const allResponses = await Promise.all(
          queryList.map((q) =>
            premiumSearch(channelId, q, {
              limit: Math.ceil(limit / queryList.length) + 2,
              expandQueries: true,
              includeContext: true,
            }),
          ),
        );

        // Merge results, deduplicate by video+chunk
        const seen = new Set<string>();
        const merged: typeof allResponses[0]["results"][number][] = [];
        for (const { results } of allResponses) {
          for (const r of results) {
            const key = `${r.videoId}:${r.content.slice(0, 80)}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(r);
            }
          }
        }

        // Sort by score and take top N
        merged.sort((a, b) => b.score - a.score);
        const topResults = merged.slice(0, limit);

        if (topResults.length === 0) {
          return "No relevant content found. The channel may not cover this topic, or transcripts haven't been fetched yet.";
        }

        const confidenceEmoji = { high: "●", medium: "◐", low: "○" } as const;

        const lines = topResults.map((r, i) => {
          const conf = confidenceEmoji[r.confidence];
          const similarity = (r.similarity * 100).toFixed(0);
          const sourceTag = r.sources.length > 1
            ? ` [${r.sources.join("+")}]`
            : "";
          const timestamp = r.startSec != null
            ? ` ⏱ ${formatSeconds(r.startSec)}`
            : "";
          const snippet = r.expandedContent
            ? r.expandedContent.slice(0, 400)
            : r.content.slice(0, 300);
          return `${i + 1}. ${conf} **${r.videoTitle}**${timestamp} — ${similarity}% match (${r.confidence})${sourceTag}\n   "${snippet}..."`;
        });

        const totalCandidates = allResponses.reduce((s, r) => s + r.metrics.totalCandidates, 0);
        const totalMs = allResponses.reduce((s, r) => s + r.metrics.durationMs, 0);

        const searchInfo = queryList.length > 1
          ? `\n_${queryList.length} parallel queries searched ${totalCandidates} candidates in ${totalMs}ms._`
          : allResponses[0]?.metrics.queryExpansion
            ? `\n_${totalCandidates} candidates evaluated in ${totalMs}ms._`
            : "";

        return `Found ${topResults.length} relevant segments:\n\n${lines.join("\n\n")}${searchInfo}`;
      } finally {
        done();
      }
    },
    {
      name: "semantic_search",
      description:
        "Advanced hybrid search across all channel transcripts — combines semantic meaning, keyword matching, and multi-angle query expansion. Supports MULTIPLE parallel queries for complex questions. Use as the FIRST tool when the user asks about a topic, concept, or question. Returns transcript excerpts with confidence levels (high/medium/low), video timestamps, and expanded context. Do NOT use for browsing videos by title — use list_videos instead.",
      schema: z.object({
        queries: z
          .array(z.string())
          .min(1)
          .max(5)
          .describe("One or more search queries to run in parallel. Use multiple queries to search from different angles (e.g. ['React hooks tutorial', 'useState useEffect examples'])"),
        limit: z
          .number()
          .min(1)
          .max(15)
          .default(8)
          .describe("Maximum total results across all queries (default 8)"),
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
          `## Channel Info`,
          `**Overview:** ${metadata.overview}`,
          `**Video types:** ${metadata.associated_video_types}`,
          `**Category:** ${metadata.category}`,
          `**Language:** ${metadata.language}`,
          `**Metadata version:** ${metadata.version}`,
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

  const exploreKnowledgeGraph = tool(
    async ({ topic, limit }) => {
      const done = log.time(`explore_knowledge_graph topic="${topic}"`);
      try {
        const node = await knowledgeRepo.findNodeByLabel(channelId, topic);
        if (!node) {
          const topNodes = await knowledgeRepo.findTopNodes(channelId, 10);
          if (topNodes.length === 0) {
            return "Knowledge graph has not been built for this channel yet. Suggest using POST /api/knowledge/build to generate it.";
          }
          const suggestions = topNodes
            .map((n) => n.label)
            .join(", ");
          return `Topic "${topic}" not found in knowledge graph. Available topics include: ${suggestions}`;
        }

        const { refs, neighbors } = await knowledgeRepo.findNodeDetails(node.id);

        const videoLines = deduplicateByKey(refs, (r) => r.video_id)
          .slice(0, limit)
          .map((r, i) => `${i + 1}. "${r.video_title}" [${r.youtube_video_id}]`)
          .join("\n");

        const neighborLines = neighbors
          .slice(0, 10)
          .map((n) => {
            const dir = n.source_id === node.id ? "→" : "←";
            return `- ${dir} ${n.neighbor_label} (${n.relationship})`;
          })
          .join("\n");

        return [
          `**${node.label}** (${node.type})`,
          node.description ? `Description: ${node.description}` : "",
          `Mentioned ${node.mention_count} times, importance: ${node.importance.toFixed(1)}`,
          videoLines ? `\nVideos covering this topic:\n${videoLines}` : "",
          neighborLines ? `\nRelated concepts:\n${neighborLines}` : "",
        ].filter(Boolean).join("\n");
      } finally {
        done();
      }
    },
    {
      name: "explore_knowledge_graph",
      description:
        "Explore the channel's knowledge graph to find how concepts connect. Use when asked 'what topics are related to X?', 'what videos cover X?', or 'how does X relate to Y?'. Returns the concept, related topics, and videos where it's discussed. Requires the knowledge graph to be built first.",
      schema: z.object({
        topic: z.string().describe("The topic/concept to explore (e.g. 'React Hooks', 'TypeScript')"),
        limit: z.number().min(1).max(10).default(5).describe("Max videos to show"),
      }),
    },
  );

  const findLearningPathTool = tool(
    async ({ from, to }) => {
      const done = log.time(`find_learning_path from="${from}" to="${to}"`);
      try {
        const count = await knowledgeRepo.nodeCount(channelId);
        if (count === 0) {
          return "Knowledge graph has not been built for this channel yet.";
        }

        const result = await findLearningPathByChannelId(channelId, from, to);

        if (!result.found) {
          return `No learning path found from "${from}" to "${to}". They may not be connected in this channel's content. Try exploring each topic separately with explore_knowledge_graph.`;
        }

        const steps = result.path
          .map((step, i) => {
            const arrow = step.relationship ? ` —[${step.relationship}]→ ` : "";
            return `${i + 1}. ${step.label} (${step.type})${i < result.path.length - 1 ? arrow : ""}`;
          })
          .join("\n");

        return `Learning path from "${from}" to "${to}" (${result.totalSteps} steps):\n\n${steps}`;
      } finally {
        done();
      }
    },
    {
      name: "find_learning_path",
      description:
        "Find the learning path between two concepts — what you need to learn to get from A to B. Use when asked 'how do I get from X to Y?', 'what should I learn before Y?', or 'what's the path from basic to advanced X?'. Returns step-by-step concept chain with relationship types.",
      schema: z.object({
        from: z.string().describe("Starting concept (e.g. 'JavaScript')"),
        to: z.string().describe("Target concept (e.g. 'React Hooks')"),
      }),
    },
  );

  const buildKnowledgeGraph = tool(
    async ({ tags, force }) => {
      const done = log.time(`build_knowledge_graph tags=${tags?.join(",") ?? "*"}`);
      try {
        const status = await buildChannelGraphById(channelId, force ?? false, undefined, tags);
        if (status.status === "running") {
          const tagInfo = tags && tags.length > 0 ? ` for tags: ${tags.join(", ")}` : "";
          return `Knowledge graph build started${tagInfo}. Build ID: ${status.buildId}. Processing ${status.totalVideos} videos in the background. Check status with get_build_status tool or GET /api/knowledge/build.`;
        }
        return `Knowledge graph is already up to date. Total videos processed: ${status.processedVideos}.`;
      } catch (err) {
        return `Failed to start knowledge build: ${err instanceof Error ? err.message : String(err)}`;
      } finally {
        done();
      }
    },
    {
      name: "build_knowledge_graph",
      description:
        "Trigger a knowledge graph build for this channel. Use when the user asks to 'build knowledge', 'create knowledge graph', or 'analyze topics'. Optionally filter by tags to build topic-specific knowledge (e.g. tags=['react','typescript'] only processes videos tagged with those topics). Returns build status.",
      schema: z.object({
        tags: z
          .array(z.string())
          .optional()
          .describe("Optional topic tags to filter videos (e.g. ['react', 'typescript']). Omit to build from all transcribed videos."),
        force: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, clears existing graph and rebuilds from scratch"),
      }),
    },
  );

  return [listVideos, getTranscript, semanticSearch, getChannelInfo, getLatestDigest, findContentGaps, exploreKnowledgeGraph, findLearningPathTool, buildKnowledgeGraph];
}
