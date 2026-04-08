import { describe, test, expect, mock, beforeEach } from "bun:test";

// Must mock BEFORE any import that touches ai/client
// The path is relative from the MODULE that imports it (query-expander → ../ai/client)
mock.module("../../ai/client", () => ({
  chatCompletion: mock(async () =>
    JSON.stringify({
      variants: ["What are React hooks?", "React useState useEffect tutorial"],
      keywords: ["React", "hooks", "useState"],
      intent: "specific",
    }),
  ),
  parseJsonResponse: <T>(content: string): T => JSON.parse(content) as T,
}));

// Also mock the logger to avoid noise
mock.module("../../lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    time: () => () => {},
  }),
}));

// Now safe to import
const { expandQuery } = await import("../query-expander");
const { chatCompletion } = await import("../../ai/client");

beforeEach(() => {
  (chatCompletion as ReturnType<typeof mock>).mockClear();
});

describe("expandQuery", () => {
  test("returns expanded query with variants, keywords, and intent", async () => {
    const result = await expandQuery("React hooks tutorial");

    expect(result.original).toBe("React hooks tutorial");
    expect(result.variants.length).toBeGreaterThan(0);
    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.intent).toBe("specific");
  });

  test("preserves original query", async () => {
    const result = await expandQuery("TypeScript generics");
    expect(result.original).toBe("TypeScript generics");
  });

  test("limits variants to max 3", async () => {
    (chatCompletion as ReturnType<typeof mock>).mockResolvedValueOnce(
      JSON.stringify({
        variants: ["a", "b", "c", "d", "e"],
        keywords: ["x"],
        intent: "exploratory",
      }),
    );

    const result = await expandQuery("too many variants");
    expect(result.variants.length).toBeLessThanOrEqual(3);
  });

  test("limits keywords to max 5", async () => {
    (chatCompletion as ReturnType<typeof mock>).mockResolvedValueOnce(
      JSON.stringify({
        variants: ["a"],
        keywords: ["k1", "k2", "k3", "k4", "k5", "k6", "k7"],
        intent: "specific",
      }),
    );

    const result = await expandQuery("too many keywords");
    expect(result.keywords.length).toBeLessThanOrEqual(5);
  });

  test("falls back to original on LLM failure", async () => {
    (chatCompletion as ReturnType<typeof mock>).mockRejectedValueOnce(
      new Error("API timeout"),
    );

    const result = await expandQuery("React hooks tutorial");

    expect(result.original).toBe("React hooks tutorial");
    expect(result.variants).toEqual([]);
    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.intent).toBe("specific");
  });

  test("handles invalid intent gracefully", async () => {
    (chatCompletion as ReturnType<typeof mock>).mockResolvedValueOnce(
      JSON.stringify({
        variants: ["a"],
        keywords: ["b"],
        intent: "nonsense",
      }),
    );

    const result = await expandQuery("test");
    expect(result.intent).toBe("specific");
  });

  test("handles missing fields in LLM response", async () => {
    (chatCompletion as ReturnType<typeof mock>).mockResolvedValueOnce(
      JSON.stringify({}),
    );

    const result = await expandQuery("test");
    expect(result.variants).toEqual([]);
    expect(result.keywords).toEqual([]);
  });

  test("valid intents are preserved", async () => {
    for (const intent of ["specific", "exploratory", "comparative", "temporal"]) {
      (chatCompletion as ReturnType<typeof mock>).mockResolvedValueOnce(
        JSON.stringify({ variants: [], keywords: [], intent }),
      );

      const result = await expandQuery(`test ${intent}`);
      expect(result.intent).toBe(intent);
    }
  });
});
