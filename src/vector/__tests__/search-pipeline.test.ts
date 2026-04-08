import { describe, test, expect, mock, beforeEach } from "bun:test";

// ─── Mock ALL external dependencies before any import ───────────────

// Mock embedder (throws without OPENAI_API_KEY)
const mockEmbedText = mock(async () => [0.1, 0.2, 0.3]);
const mockEmbedTexts = mock(async (texts: string[]) =>
  texts.map(() => [0.1, 0.2, 0.3]),
);
mock.module("../embedder", () => ({
  embedText: mockEmbedText,
  embedTexts: mockEmbedTexts,
}));

// Mock ai/client (throws without DEEPSEEK_API_KEY)
mock.module("../../ai/client", () => ({
  chatCompletion: mock(async () => "{}"),
  parseJsonResponse: <T>(content: string): T => JSON.parse(content) as T,
}));

// Mock logger
mock.module("../../lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    time: () => () => {},
  }),
}));

// Mock store with enriched search functions
const mockVectorSearch = mock(async () => [
  {
    content: "React hooks allow you to use state in functional components.",
    videoId: "v-1",
    videoTitle: "React Hooks Tutorial",
    videoUrl: "https://youtube.com/watch?v=1",
    transcriptId: "t-1",
    chunkIndex: 0,
    similarity: 0.85,
    importance: 0.7,
    videoViewCount: 5000,
    startSec: 45.5,
  },
  {
    content: "useState is the most basic React hook for managing state.",
    videoId: "v-2",
    videoTitle: "useState Deep Dive",
    videoUrl: "https://youtube.com/watch?v=2",
    transcriptId: "t-2",
    chunkIndex: 0,
    similarity: 0.72,
    importance: 0.5,
    videoViewCount: 3000,
    startSec: 120,
  },
]);

const mockVectorSearchMulti = mock(async () => [
  {
    content: "React hooks intro",
    videoId: "v-1",
    videoTitle: "Hooks",
    videoUrl: "https://youtube.com/watch?v=1",
    transcriptId: "t-1",
    chunkIndex: 0,
    similarity: 0.80,
    importance: 0.6,
    videoViewCount: 4000,
    startSec: 30,
    channelId: "ch-1",
    channelName: "Channel A",
  },
]);

const mockKeywordSearch = mock(async () => [
  {
    content: "React hooks are a powerful feature.",
    videoId: "v-1",
    videoTitle: "React Hooks Tutorial",
    videoUrl: "https://youtube.com/watch?v=1",
    transcriptId: "t-1",
    chunkIndex: 1,
    importance: 0.7,
    videoViewCount: 5000,
    startSec: 50,
    rank: 0.8,
  },
]);

const mockKeywordSearchMulti = mock(async () => []);
const mockFetchAdjacent = mock(async () => [
  { chunkIndex: 1, content: "This is the adjacent chunk context." },
]);

mock.module("../store", () => ({
  vectorSearchEnriched: mockVectorSearch,
  vectorSearchEnrichedMulti: mockVectorSearchMulti,
  keywordSearch: mockKeywordSearch,
  keywordSearchMulti: mockKeywordSearchMulti,
  fetchAdjacentChunks: mockFetchAdjacent,
}));

// Mock query expander
const mockExpand = mock(async () => ({
  original: "React hooks",
  variants: ["What are React hooks?", "useState useEffect tutorial"],
  keywords: ["React", "hooks", "useState"],
  intent: "specific" as const,
}));

mock.module("../query-expander", () => ({
  expandQuery: mockExpand,
}));

// ─── Now import the module under test ───────────────────────────────

const { searchChannel, searchMultiChannel } = await import("../search-pipeline");

beforeEach(() => {
  mockEmbedText.mockClear();
  mockEmbedTexts.mockClear();
  mockVectorSearch.mockClear();
  mockVectorSearchMulti.mockClear();
  mockKeywordSearch.mockClear();
  mockKeywordSearchMulti.mockClear();
  mockFetchAdjacent.mockClear();
  mockExpand.mockClear();
});

describe("searchChannel (single-channel pipeline)", () => {
  test("returns pipeline results with metrics", async () => {
    const response = await searchChannel("ch-1", "React hooks");

    expect(response.results).toBeDefined();
    expect(response.metrics).toBeDefined();
    expect(response.metrics.totalCandidates).toBeGreaterThan(0);
    expect(response.metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("calls query expansion by default", async () => {
    await searchChannel("ch-1", "React hooks");
    expect(mockExpand).toHaveBeenCalledWith("React hooks");
  });

  test("skips query expansion when disabled", async () => {
    await searchChannel("ch-1", "React hooks", { expandQueries: false });
    expect(mockExpand).not.toHaveBeenCalled();
  });

  test("embeds original query", async () => {
    await searchChannel("ch-1", "test query");
    expect(mockEmbedText).toHaveBeenCalledWith("test query");
  });

  test("embeds expanded variants", async () => {
    await searchChannel("ch-1", "React hooks");
    expect(mockEmbedTexts).toHaveBeenCalledWith([
      "What are React hooks?",
      "useState useEffect tutorial",
    ]);
  });

  test("runs keyword search with extracted keywords", async () => {
    await searchChannel("ch-1", "React hooks");
    expect(mockKeywordSearch).toHaveBeenCalled();
    const call = mockKeywordSearch.mock.calls[0]!;
    expect(call[0]).toBe("ch-1");
    expect(call[1]).toEqual(["React", "hooks", "useState"]);
  });

  test("results have confidence levels", async () => {
    const response = await searchChannel("ch-1", "React hooks");

    for (const r of response.results) {
      expect(["high", "medium", "low"]).toContain(r.confidence);
    }
  });

  test("results have source tracking", async () => {
    const response = await searchChannel("ch-1", "React hooks");

    for (const r of response.results) {
      expect(r.sources.length).toBeGreaterThan(0);
    }
  });

  test("fetches adjacent chunks for context expansion", async () => {
    const response = await searchChannel("ch-1", "React hooks", {
      includeContext: true,
    });

    const hasExpanded = response.results.some((r) => r.expandedContent !== null);
    expect(hasExpanded).toBe(true);
  });

  test("skips context expansion when disabled", async () => {
    mockFetchAdjacent.mockClear();
    await searchChannel("ch-1", "React hooks", { includeContext: false });
    expect(mockFetchAdjacent).not.toHaveBeenCalled();
  });

  test("respects limit parameter", async () => {
    const response = await searchChannel("ch-1", "React hooks", { limit: 2 });
    expect(response.results.length).toBeLessThanOrEqual(2);
  });

  test("metrics include query expansion info", async () => {
    const response = await searchChannel("ch-1", "React hooks");

    expect(response.metrics.queryExpansion).toBeDefined();
    expect(response.metrics.queryExpansion!.variants.length).toBe(2);
    expect(response.metrics.queryExpansion!.keywords.length).toBe(3);
  });

  test("results include timestamps when available", async () => {
    const response = await searchChannel("ch-1", "React hooks");

    const withTimestamp = response.results.filter((r) => r.startSec !== null);
    expect(withTimestamp.length).toBeGreaterThan(0);
  });

  test("metrics track hit counts by source", async () => {
    const response = await searchChannel("ch-1", "React hooks");

    expect(response.metrics.vectorHits).toBeGreaterThanOrEqual(0);
    expect(response.metrics.keywordHits).toBeGreaterThanOrEqual(0);
    expect(response.metrics.expandedHits).toBeGreaterThanOrEqual(0);
  });
});

describe("searchMultiChannel (multi-channel pipeline)", () => {
  test("returns results with channel info", async () => {
    const response = await searchMultiChannel(["ch-1", "ch-2"], "React");

    expect(response.results).toBeDefined();
    for (const r of response.results) {
      expect(r.channelId).toBeDefined();
      expect(r.channelName).toBeDefined();
    }
  });

  test("works with multiple channel IDs", async () => {
    const response = await searchMultiChannel(
      ["ch-1", "ch-2", "ch-3"],
      "React hooks",
    );

    expect(response.metrics).toBeDefined();
    expect(response.metrics.totalCandidates).toBeGreaterThanOrEqual(0);
  });

  test("handles empty results across all strategies", async () => {
    mockVectorSearchMulti.mockImplementation(async () => []);
    mockKeywordSearchMulti.mockResolvedValueOnce([]);

    const response = await searchMultiChannel(["ch-1"], "nonexistent topic", {
      expandQueries: false,
    });
    expect(response.results).toEqual([]);

    // Restore default mock
    mockVectorSearchMulti.mockImplementation(async () => [
      {
        content: "React hooks intro",
        videoId: "v-1",
        videoTitle: "Hooks",
        videoUrl: "https://youtube.com/watch?v=1",
        transcriptId: "t-1",
        chunkIndex: 0,
        similarity: 0.80,
        importance: 0.6,
        videoViewCount: 4000,
        channelId: "ch-1",
        channelName: "Channel A",
      },
    ]);
  });
});
