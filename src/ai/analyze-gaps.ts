import { chatCompletion, parseJsonResponse } from "./client";
import type { ContentGap } from "../repositories/content-gap.repo";
import type { ExtractedTopic } from "./extract-topics";

export interface GapAnalysisParams {
  readonly channelName: string;
  readonly category: string;
  readonly channelOverview: string;
  readonly existingTopics: ReadonlyArray<ExtractedTopic>;
  readonly nicheTopics: ReadonlyArray<string>;
  readonly nicheContext: string;
  readonly videoTitles: ReadonlyArray<string>;
  readonly totalVideos: number;
}

export interface GapAnalysisOutput {
  readonly gaps: ReadonlyArray<ContentGap>;
  readonly summary: string;
}

export async function analyzeContentGaps(
  params: GapAnalysisParams,
): Promise<GapAnalysisOutput> {
  const topicBlock = params.existingTopics
    .map((t) => `- "${t.label}": ${t.description} (themes: ${t.themes.join(", ")})`)
    .join("\n");

  const nicheBlock = params.nicheTopics
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  const titleBlock = params.videoTitles.slice(0, 20).join("\n");

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a senior YouTube content strategist specializing in ${params.category} channels.

## Channel Profile
- Name: ${params.channelName}
- Category: ${params.category}
- Overview: ${params.channelOverview}
- Total videos: ${params.totalVideos}

## Topics Already Covered
${topicBlock}

## Niche Landscape
${params.nicheContext}

## Reference Topics in This Niche
${nicheBlock}

## Recent Video Titles (for style reference)
${titleBlock}

## Your Task

Identify 5-15 content gaps — topics this channel SHOULD cover but HASN'T yet.

For each gap:
1. "topic" — missing topic (2-5 words)
2. "reason" — WHY this channel should cover it. Be specific, connect to existing content. 2-3 sentences.
3. "confidence" — "high" (clearly missing), "medium" (probably missing), "low" (might be partially covered)
4. "priority" — 1-100: audience demand (40%), relevance (30%), trending (20%), ease (10%)
5. "category" — subcategory within the niche
6. "adjacentTopics" — 1-3 existing topic labels this connects to
7. "suggestedVideoTitle" — compelling title matching the channel's style
8. "suggestedAngle" — unique angle for this channel

RULES:
- Do NOT suggest topics already covered
- Prioritize topics where this channel has natural advantage
- Be SPECIFIC: "Advanced TypeScript patterns" not "programming"
- suggestedVideoTitle should match the channel's title style

Return ONLY valid JSON: { "gaps": [...], "summary": "2-3 sentence executive summary" }`,
      },
      {
        role: "user",
        content: `Analyze content gaps for "${params.channelName}".`,
      },
    ],
    { maxTokens: 2000 },
  );

  const parsed = parseJsonResponse<GapAnalysisOutput>(content);

  return {
    gaps: (parsed.gaps ?? []).map((g) => ({
      topic: g.topic ?? "",
      reason: g.reason ?? "",
      confidence: (["high", "medium", "low"].includes(g.confidence) ? g.confidence : "medium") as "high" | "medium" | "low",
      priority: Math.min(100, Math.max(1, Number(g.priority) || 50)),
      category: g.category ?? params.category,
      adjacentTopics: g.adjacentTopics ?? [],
      suggestedVideoTitle: g.suggestedVideoTitle ?? "",
      suggestedAngle: g.suggestedAngle ?? "",
    })),
    summary: parsed.summary ?? "",
  };
}
