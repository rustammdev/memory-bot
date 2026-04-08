import { chatCompletion, parseJsonResponse } from "../ai/client";
import { createLogger } from "../lib/logger";

const log = createLogger("query-expander");

export interface ExpandedQuery {
  readonly original: string;
  readonly variants: ReadonlyArray<string>;
  readonly keywords: ReadonlyArray<string>;
  readonly intent: "specific" | "exploratory" | "comparative" | "temporal";
}

interface LLMExpansionResult {
  readonly variants: string[];
  readonly keywords: string[];
  readonly intent: string;
}

const EXPANSION_PROMPT = `You are a search query expander for a YouTube channel knowledge base.
Given a user query, generate alternative search queries and extract keywords.

Rules:
1. Generate 2-3 variant queries that capture different angles of the same intent.
   - Rephrase with synonyms, related terms, or different specificity levels.
   - One variant should be MORE specific, one should be BROADER.
   - If the query is in a non-English language, generate one variant in English too.
2. Extract 3-5 individual keywords/phrases that are most searchable.
   - Include technical terms, proper nouns, and core concepts.
   - Do NOT include stop words or generic terms.
3. Classify the intent:
   - "specific" — looking for a concrete answer or specific content
   - "exploratory" — browsing/discovering what exists on a topic
   - "comparative" — comparing topics, approaches, or videos
   - "temporal" — asking about recent/new/latest content

Respond with ONLY valid JSON:
{
  "variants": ["query1", "query2"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "intent": "specific"
}`;

const VALID_INTENTS = new Set(["specific", "exploratory", "comparative", "temporal"]);

function classifyIntent(raw: string): ExpandedQuery["intent"] {
  return VALID_INTENTS.has(raw) ? raw as ExpandedQuery["intent"] : "specific";
}

export async function expandQuery(query: string): Promise<ExpandedQuery> {
  const done = log.time(`expand query="${query.slice(0, 60)}"`);
  try {
    const response = await chatCompletion(
      [
        { role: "system", content: EXPANSION_PROMPT },
        { role: "user", content: query },
      ],
      { maxTokens: 300 },
    );

    const parsed = parseJsonResponse<LLMExpansionResult>(response);

    return {
      original: query,
      variants: (parsed.variants ?? []).slice(0, 3),
      keywords: (parsed.keywords ?? []).slice(0, 5),
      intent: classifyIntent(parsed.intent ?? "specific"),
    };
  } catch (err) {
    log.warn("query expansion failed, using original", { err: String(err) });
    return {
      original: query,
      variants: [],
      keywords: extractFallbackKeywords(query),
      intent: "specific",
    };
  } finally {
    done();
  }
}

function extractFallbackKeywords(query: string): ReadonlyArray<string> {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "because", "but", "and", "or", "if", "while", "about", "what", "which",
    "who", "whom", "this", "that", "these", "those", "am", "it", "its",
    "bu", "va", "bilan", "uchun", "haqida", "qanday", "nima", "qaysi",
    "har", "bir", "bo'lgan", "kerak", "mumkin",
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}
