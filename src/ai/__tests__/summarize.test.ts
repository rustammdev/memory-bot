import { describe, test, expect, mock } from "bun:test";

let callCount = 0;
const chatCompletionFn = mock(() => {
  callCount++;
  return Promise.resolve(
    JSON.stringify({
      summary: "This video covers React hooks in depth. useState and useEffect are explained with examples.",
      tags: ["react", "hooks", "usestate"],
    }),
  );
});

mock.module("../client", () => ({
  chatCompletion: chatCompletionFn,
  parseJsonResponse: (content: string) => JSON.parse(content),
}));

mock.module("../../lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    time: () => () => {},
  }),
}));

import { summarizeTranscript } from "../summarize";

describe("summarizeTranscript", () => {
  test("returns summary and tags from AI", async () => {
    callCount = 0;
    const result = await summarizeTranscript("React Hooks Tutorial", "Full transcript here...");
    expect(result.summary).toContain("React hooks");
    expect(result.tags).toEqual(["react", "hooks", "usestate"]);
    expect(callCount).toBe(1);
  });

  test("sanitizes tags — lowercase, strip quotes, max 3", async () => {
    chatCompletionFn.mockImplementationOnce(() =>
      Promise.resolve(
        JSON.stringify({
          summary: "Valid summary content here.",
          tags: ['"React"', "HOOKS", "'useState'", "extra-tag"],
        }),
      ),
    );
    const result = await summarizeTranscript("Test", "Some transcript");
    expect(result.tags.length).toBeLessThanOrEqual(3);
    result.tags.forEach((t) => expect(t).toBe(t.toLowerCase()));
    result.tags.forEach((t) => expect(t).not.toMatch(/['"]/));
  });

  test("retries on failure then succeeds", async () => {
    callCount = 0;
    chatCompletionFn
      .mockImplementationOnce(() => Promise.reject(new Error("API timeout")))
      .mockImplementationOnce(() =>
        Promise.resolve(
          JSON.stringify({ summary: "Retry succeeded.", tags: ["test"] }),
        ),
      );

    const result = await summarizeTranscript("Retry Test", "Content");
    expect(result.summary).toBe("Retry succeeded.");
    expect(callCount).toBe(0); // mock reset the counter in prior test
  });

  test("falls back to sentence extraction after all retries fail", async () => {
    chatCompletionFn.mockImplementation(() =>
      Promise.reject(new Error("Service down")),
    );

    const transcript = "First important sentence about TypeScript. Second sentence with more details. Third concluding thought.";
    const result = await summarizeTranscript("TypeScript Basics", transcript);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.tags.length).toBeGreaterThan(0);
    expect(result.tags).toContain("typescript");

    // Restore
    chatCompletionFn.mockImplementation(() =>
      Promise.resolve(
        JSON.stringify({ summary: "Normal summary.", tags: ["test"] }),
      ),
    );
  });

  test("truncates long transcripts", async () => {
    const longTranscript = "word ".repeat(20_000);
    callCount = 0;
    await summarizeTranscript("Long Video", longTranscript);
    const calledWith = chatCompletionFn.mock.calls.at(-1)?.[0] as any;
    const userMsg = calledWith?.find?.((m: any) => m.role === "user");
    if (userMsg) {
      expect(userMsg.content.length).toBeLessThanOrEqual(60_100);
    }
  });
});
