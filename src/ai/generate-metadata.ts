import { chatCompletion, parseJsonResponse } from "./client";
import { CHANNEL_CATEGORIES, CHANNEL_LANGUAGES } from "../lib/enums";
import type { ChannelCategory, ChannelLanguage } from "../lib/enums";

export interface VideoSummary {
  readonly title: string;
  readonly summary: string;
}

export interface GeneratedMetadata {
  readonly overview: string;
  readonly associatedVideoTypes: string;
  readonly category: string;
  readonly language: string;
}

const MAX_SUMMARIES = 50;

export async function generateChannelMetadata(
  channelName: string,
  summaries: ReadonlyArray<VideoSummary>,
): Promise<GeneratedMetadata> {
  const limited = summaries.slice(0, MAX_SUMMARIES);
  const summaryBlock = limited
    .map((s, i) => `${i + 1}. "${s.title}"\n${s.summary}`)
    .join("\n\n");

  const content = await chatCompletion([
    {
      role: "system",
      content: `You analyze YouTube channels based on their video summaries. Return ONLY valid JSON with these exact fields:

    {
      "overview": "Detailed channel description based on actual content. Mention specific topics, recurring themes, and the creator's perspective. 3-5 sentences.",
      "associatedVideoTypes": "Comma-separated list of video types/formats this channel produces (e.g. 'tutorials, explainers, reviews, deep-dives')",
      "category": "ONE of: ${CHANNEL_CATEGORIES.join(", ")}",
      "language": "Primary language code, ONE of: ${CHANNEL_LANGUAGES.join(", ")}"
    }

    Be specific and factual. Base everything on the actual video summaries provided.`,
    },
    {
      role: "user",
      content: `Channel: "${channelName}"

Video summaries (${limited.length} of ${summaries.length} videos):

${summaryBlock}`,
    },
  ]);

  const parsed = parseJsonResponse<GeneratedMetadata>(content);

  return {
    overview: parsed.overview,
    associatedVideoTypes: parsed.associatedVideoTypes,
    category: CHANNEL_CATEGORIES.includes(parsed.category as ChannelCategory)
      ? parsed.category
      : "other",
    language: CHANNEL_LANGUAGES.includes(parsed.language as ChannelLanguage)
      ? parsed.language
      : "other",
  };
}
