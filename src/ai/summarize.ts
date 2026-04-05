import { chatCompletion, parseJsonResponse } from "./client";

const MAX_TRANSCRIPT_CHARS = 60_000;
const MAX_TAGS = 3;

export interface SummaryResult {
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
}

export async function summarizeTranscript(
  videoTitle: string,
  transcript: string,
): Promise<SummaryResult> {
  const trimmed = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : transcript;

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a concise video summarizer. Return ONLY valid JSON with two fields:
- "summary": 4-6 sentence summary. Include core topic, key facts (names, numbers, specifics), and main conclusion. No filler, no intro phrases. Same language as transcript.
- "tags": array of exactly ${MAX_TAGS} most relevant topic tags (technologies, concepts, names). Pick only the top ${MAX_TAGS} — the ones that best identify this video's core subject. Lowercase, 1-3 words each. English only.

Example: {"summary": "...", "tags": ["rust", "memory safety", "borrow checker"]}`,
      },
      {
        role: "user",
        content: `Video: "${videoTitle}"\n\n${trimmed}`,
      },
    ],
    { maxTokens: 400 },
  );

  const parsed = parseJsonResponse<{ summary: string; tags: string[] }>(content);

  const summary = (parsed.summary ?? "").trim();
  const tags = (parsed.tags ?? [])
    .filter((t) => typeof t === "string" && t.length > 0)
    .map((t) => t.toLowerCase().trim().replace(/^["']+|["']+$/g, ""))
    .filter((t) => t.length > 0)
    .slice(0, MAX_TAGS);

  return { summary, tags };
}
