import { ExternalServiceError } from "../lib/errors";

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 20;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

interface EmbeddingResponse {
  readonly data: ReadonlyArray<{ readonly embedding: number[] }>;
}

async function fetchEmbeddings(
  texts: ReadonlyArray<string>,
): Promise<ReadonlyArray<number[]>> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ExternalServiceError("OpenAI", `HTTP ${response.status}: ${body}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  return data.data.map((d) => d.embedding);
}

export async function embedTexts(
  texts: ReadonlyArray<string>,
): Promise<ReadonlyArray<number[]>> {
  if (texts.length <= BATCH_SIZE) {
    return fetchEmbeddings(texts);
  }

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await fetchEmbeddings(batch);
    results.push(...embeddings);
  }
  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  const embedding = results[0];
  if (!embedding) {
    throw new ExternalServiceError("OpenAI", "No embedding returned");
  }
  return embedding;
}
