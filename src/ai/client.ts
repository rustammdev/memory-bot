import { ExternalServiceError } from "../lib/errors";

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

interface ChatCompletionResponse {
  readonly choices: ReadonlyArray<{
    readonly message: { readonly content: string };
  }>;
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}

interface CompletionOptions {
  readonly model?: string;
  readonly maxTokens?: number;
}

export async function chatCompletion(
  messages: ReadonlyArray<ChatMessage>,
  options: CompletionOptions = {},
): Promise<string> {
  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model ?? "deepseek-chat",
      messages,
      temperature: 0.3,
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ExternalServiceError("DeepSeek", `HTTP ${response.status}: ${body}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message.content;
  if (!content) {
    throw new ExternalServiceError("DeepSeek", "empty response");
  }

  return content;
}

export function parseJsonResponse<T>(content: string): T {
  const cleaned = content.replace(/```(?:json)?\n?([\s\S]*?)```/, "$1").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new ExternalServiceError(
      "DeepSeek",
      `Invalid JSON response: ${cleaned.slice(0, 200)}`,
    );
  }
}
