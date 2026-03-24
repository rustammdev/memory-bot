import { chatCompletion } from "./client";

const MAX_TRANSCRIPT_CHARS = 60_000;

export async function summarizeTranscript(
  videoTitle: string,
  transcript: string,
): Promise<string> {
  const trimmed = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : transcript;

  const content = await chatCompletion(
    [
      {
        role: "system",
        content: `You are a concise video summarizer. Write a 4-6 sentence summary. Include only the core topic, key facts (names, numbers, specifics), and main conclusion. No filler, no intro phrases. Same language as transcript.`,
      },
      {
        role: "user",
        content: `Video: "${videoTitle}"\n\n${trimmed}`,
      },
    ],
    { maxTokens: 300 },
  );

  return content;
}
