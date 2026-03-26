import { chatCompletion, parseJsonResponse } from "./client";
import type { DigestHighlight, DigestTopicCluster } from "../repositories/digest.repo";

export interface DigestVideoInput {
  readonly youtubeVideoId: string;
  readonly title: string;
  readonly viewCount: number;
  readonly viewVelocity: number;
  readonly summary: string | null;
  readonly durationFormatted: string | null;
}

export interface DigestInput {
  readonly channelName: string;
  readonly category: string;
  readonly personaTone: string;
  readonly personaStyle: string;
  readonly newVideos: ReadonlyArray<DigestVideoInput>;
  readonly previousDigestSummary: string | null;
  readonly userInterests: string | null;
  readonly periodLabel: string;
}

interface GeneratedDigest {
  readonly summary: string;
  readonly highlights: ReadonlyArray<DigestHighlight>;
  readonly topicClusters: ReadonlyArray<DigestTopicCluster>;
  readonly trendAnalysis: string;
}

const MAX_VIDEOS_IN_PROMPT = 30;

export async function generateDigest(
  input: DigestInput,
): Promise<GeneratedDigest> {
  const videos = input.newVideos.slice(0, MAX_VIDEOS_IN_PROMPT);

  const videoBlock = videos
    .map(
      (v, i) =>
        `${i + 1}. "${v.title}" [${v.youtubeVideoId}] — ${v.viewCount} views, ${v.viewVelocity.toFixed(0)} views/day, ${v.durationFormatted ?? "unknown"}${v.summary ? `\n   Summary: ${v.summary}` : ""}`,
    )
    .join("\n");

  const previousSection = input.previousDigestSummary
    ? `\n## Previous Digest Summary\n${input.previousDigestSummary}`
    : "\nThis is the FIRST digest for this channel — establish baseline topics.";

  const userSection = input.userInterests
    ? `\n## Reader Interests\nThe reader is particularly interested in: ${input.userInterests}. Emphasize matching content in summary and highlights.`
    : "";

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a content digest writer for the YouTube channel "${input.channelName}" (${input.category} channel).

PERSONALITY:
- Tone: ${input.personaTone}
- Style: ${input.personaStyle}

Write a weekly digest covering ${input.periodLabel}. The channel published ${videos.length} new videos.

INSTRUCTIONS:
1. "summary" — 3-5 sentence editorial summary in the channel's voice. Tell the reader what MATTERS this week.
2. "highlights" — Top 3-5 most noteworthy videos. For each: videoId (YouTube ID), title, reason WHY it matters, viewVelocity (number).
3. "topicClusters" — Group videos into 2-4 topic clusters. Each: topic name, array of videoIds, 1-2 sentence description.
4. "trendAnalysis" — Compare with previous digest. New topics? Abandoned topics? Acceleration or deceleration?
${userSection}

Return ONLY valid JSON: { "summary": "...", "highlights": [...], "topicClusters": [...], "trendAnalysis": "..." }`,
      },
      {
        role: "user",
        content: `## New Videos (${input.periodLabel})\n${videoBlock}${previousSection}`,
      },
    ],
    { maxTokens: 1500 },
  );

  const parsed = parseJsonResponse<GeneratedDigest>(content);

  return {
    summary: parsed.summary ?? "",
    highlights: (parsed.highlights ?? []).map((h) => ({
      videoId: h.videoId ?? "",
      title: h.title ?? "",
      reason: h.reason ?? "",
      viewVelocity: Number(h.viewVelocity) || 0,
    })),
    topicClusters: (parsed.topicClusters ?? []).map((c) => ({
      topic: c.topic ?? "",
      videoIds: c.videoIds ?? [],
      description: c.description ?? "",
    })),
    trendAnalysis: parsed.trendAnalysis ?? "",
  };
}
