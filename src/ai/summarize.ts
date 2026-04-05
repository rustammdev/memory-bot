import { chatCompletion, parseJsonResponse } from "./client";
import { createLogger } from "../lib/logger";

const log = createLogger("summarize");

const MAX_TRANSCRIPT_CHARS = 60_000;
const MAX_TAGS = 3;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

export interface SummaryResult {
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
}

function sanitizeTags(raw: unknown[]): ReadonlyArray<string> {
  return raw
    .filter((t) => typeof t === "string" && t.length > 0)
    .map((t) => (t as string).toLowerCase().trim().replace(/^["']+|["']+$/g, ""))
    .filter((t) => t.length > 0 && t.length <= 50)
    .slice(0, MAX_TAGS);
}

function extractFallbackTags(title: string): ReadonlyArray<string> {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, MAX_TAGS);
}

function buildFallbackSummary(title: string, transcript: string): SummaryResult {
  const sentences = transcript
    .replace(/\n+/g, " ")
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 4);

  return {
    summary: sentences.length > 0
      ? sentences.join(". ") + "."
      : `Video "${title}" content summary unavailable.`,
    tags: extractFallbackTags(title),
  };
}

async function callSummarizeApi(
  videoTitle: string,
  trimmed: string,
): Promise<SummaryResult> {
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
  if (summary.length === 0) {
    throw new Error("AI returned empty summary");
  }

  return { summary, tags: sanitizeTags(parsed.tags ?? []) };
}

export async function summarizeTranscript(
  videoTitle: string,
  transcript: string,
): Promise<SummaryResult> {
  const trimmed = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : transcript;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callSummarizeApi(videoTitle, trimmed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`summarize attempt ${attempt}/${MAX_RETRIES} failed`, { videoTitle, error: msg });

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }
    }
  }

  log.warn("All summarize attempts failed, using fallback", { videoTitle });
  return buildFallbackSummary(videoTitle, trimmed);
}
