import { chatCompletion, parseJsonResponse } from "./client";
import { CHANNEL_CATEGORIES, CHANNEL_LANGUAGES } from "../lib/enums";
import type { ChannelCategory, ChannelLanguage } from "../lib/enums";

export interface GeneratedMetadata {
  readonly overview: string;
  readonly associatedVideoTypes: string;
  readonly category: string;
  readonly language: string;
}

export const TITLE_LIMIT = 15;

export async function generateChannelMetadata(
  channelName: string,
  videoTitles: ReadonlyArray<string>,
): Promise<GeneratedMetadata> {
  const titles = videoTitles.slice(0, TITLE_LIMIT);
  const titleBlock = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You analyze YouTube channels based on their recent video titles. Return ONLY valid JSON with these exact fields:

      {
        "overview": "Channel description based on video titles. Mention specific topics, recurring themes, and the creator's focus. 3-5 sentences.",
        "associatedVideoTypes": "Comma-separated list of video types/formats (e.g. 'tutorials, explainers, reviews, deep-dives')",
        "category": "ONE of: ${CHANNEL_CATEGORIES.join(", ")}",
        "language": "Primary language code, ONE of: ${CHANNEL_LANGUAGES.join(", ")}"
      }

      Be specific and factual. Infer only from the titles provided.`,
      },
      {
        role: "user",
        content: `Channel: "${channelName}"

        Recent video titles (${titles.length}):
        ${titleBlock}`,
      },
    ],
    { maxTokens: 500 },
  );

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
