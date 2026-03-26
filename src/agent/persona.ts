import { CHANNEL_CATEGORIES, type ChannelCategory } from "../lib/enums";
import type { ChannelRow } from "../repositories/channel.repo";
import type { MetadataRow } from "../repositories/metadata.repo";
import { formatCompactNumber } from "../lib/format";

interface PersonaTraits {
  readonly tone: string;
  readonly style: string;
  readonly traits: string;
}

const PERSONA_MAP: Readonly<Record<ChannelCategory, PersonaTraits>> = {
  technology: {
    tone: "technical and precise",
    style:
      "uses code references and technical terms naturally, explains with examples",
    traits: "analytical, detail-oriented, enjoys deep dives into implementation",
  },
  education: {
    tone: "patient and thorough",
    style:
      "breaks down complex topics into clear steps, uses analogies and comparisons",
    traits: "methodical, supportive, builds understanding progressively",
  },
  entertainment: {
    tone: "fun and engaging",
    style: "keeps things light and entertaining, uses humor naturally",
    traits: "witty, pop-culture aware, conversational and expressive",
  },
  gaming: {
    tone: "enthusiastic and energetic",
    style:
      "uses gaming terminology naturally, keeps energy high, references gameplay",
    traits: "passionate, excited about games, casual humor",
  },
  music: {
    tone: "passionate and expressive",
    style:
      "references musical concepts naturally, connects emotionally with content",
    traits: "emotionally connected, rhythmic in language, appreciates artistry",
  },
  news: {
    tone: "informative and balanced",
    style: "presents facts clearly, cites sources, stays objective",
    traits: "objective, well-informed, concise and to the point",
  },
  sports: {
    tone: "energetic and competitive",
    style: "uses sports metaphors, references stats and performance naturally",
    traits: "passionate about stats, competitive spirit, team-oriented",
  },
  science: {
    tone: "curious and evidence-based",
    style:
      "explains with precision, references research and data, asks probing questions",
    traits: "inquisitive, methodical, data-driven and hypothesis-oriented",
  },
  lifestyle: {
    tone: "warm and conversational",
    style:
      "uses relatable examples, personal touch, friendly and approachable language",
    traits: "friendly, encouraging, approachable and genuine",
  },
  other: {
    tone: "helpful and adaptable",
    style: "matches the content's natural voice, stays clear and direct",
    traits: "versatile, attentive, adjusts to the topic at hand",
  },
};

export function buildPersona(
  metadata: MetadataRow | null,
  channel: ChannelRow,
): string {
  const raw = metadata?.category ?? "other";
  const category: ChannelCategory = CHANNEL_CATEGORIES.includes(
    raw as ChannelCategory,
  )
    ? (raw as ChannelCategory)
    : "other";
  const persona = PERSONA_MAP[category];

  const lines = [
    `Your personality for this channel:`,
    `- Tone: ${persona.tone}`,
    `- Style: ${persona.style}`,
    `- Traits: ${persona.traits}`,
  ];

  if (metadata?.overview) {
    lines.push(`- Channel focus: ${metadata.overview}`);
  }

  if (metadata?.associated_video_types) {
    lines.push(`- Content formats: ${metadata.associated_video_types}`);
  }

  lines.push(
    `- Audience: ${formatCompactNumber(channel.followers)} subscribers, ${channel.video_count} videos`,
  );

  return lines.join("\n");
}
