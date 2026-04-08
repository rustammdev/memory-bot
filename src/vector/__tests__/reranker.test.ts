import { describe, test, expect } from "bun:test";
import {
  reciprocalRankFusion,
  computeCompositeScores,
  mmrDiversify,
  rerank,
  type FusionCandidate,
} from "../reranker";

function makeCandidate(
  overrides: Partial<FusionCandidate> & { id: string },
): FusionCandidate {
  return {
    content: `Content for ${overrides.id}`,
    videoId: overrides.videoId ?? "v-1",
    videoTitle: overrides.videoTitle ?? "Video 1",
    videoUrl: "https://youtube.com/watch?v=1",
    transcriptId: overrides.transcriptId ?? "t-1",
    chunkIndex: overrides.chunkIndex ?? 0,
    similarity: overrides.similarity ?? 0.8,
    importance: overrides.importance ?? 0.5,
    videoViewCount: overrides.videoViewCount ?? 1000,
    source: overrides.source ?? "semantic",
    ...overrides,
  };
}

describe("reciprocalRankFusion", () => {
  test("returns empty for empty input", () => {
    const result = reciprocalRankFusion([]);
    expect(result).toEqual([]);
  });

  test("returns empty for empty lists", () => {
    const result = reciprocalRankFusion([[], []]);
    expect(result).toEqual([]);
  });

  test("fuses single list preserving order", () => {
    const list = [
      makeCandidate({ id: "a", similarity: 0.9 }),
      makeCandidate({ id: "b", similarity: 0.7 }),
    ];
    const result = reciprocalRankFusion([list]);

    expect(result.length).toBe(2);
    expect(result[0]!.candidate.id).toBe("a");
    expect(result[0]!.rrfScore).toBeGreaterThan(result[1]!.rrfScore);
  });

  test("boosts candidates appearing in multiple lists", () => {
    const semantic = [
      makeCandidate({ id: "a", similarity: 0.9, source: "semantic" }),
      makeCandidate({ id: "b", similarity: 0.7, source: "semantic" }),
    ];
    const keyword = [
      makeCandidate({ id: "b", similarity: 0, source: "keyword" }),
      makeCandidate({ id: "c", similarity: 0, source: "keyword" }),
    ];

    const result = reciprocalRankFusion([semantic, keyword]);
    const bEntry = result.find((r) => r.candidate.id === "b");

    expect(bEntry).toBeDefined();
    // b appears in both lists, so it should have sources from both
    expect(bEntry!.sources.size).toBe(2);
    expect(bEntry!.sources.has("semantic")).toBe(true);
    expect(bEntry!.sources.has("keyword")).toBe(true);
  });

  test("tracks best similarity across lists", () => {
    const list1 = [makeCandidate({ id: "a", similarity: 0.6, source: "semantic" })];
    const list2 = [makeCandidate({ id: "a", similarity: 0.9, source: "expanded_query" })];

    const result = reciprocalRankFusion([list1, list2]);
    expect(result[0]!.bestSimilarity).toBe(0.9);
  });

  test("handles three lists", () => {
    const l1 = [makeCandidate({ id: "a", source: "semantic" })];
    const l2 = [makeCandidate({ id: "a", source: "keyword" })];
    const l3 = [makeCandidate({ id: "a", source: "expanded_query" })];

    const result = reciprocalRankFusion([l1, l2, l3]);
    expect(result[0]!.sources.size).toBe(3);
  });
});

describe("computeCompositeScores", () => {
  test("returns empty for empty input", () => {
    expect(computeCompositeScores([])).toEqual([]);
  });

  test("produces scores between 0 and 1", () => {
    const fused = reciprocalRankFusion([
      [
        makeCandidate({ id: "a", similarity: 0.9, videoViewCount: 5000 }),
        makeCandidate({ id: "b", similarity: 0.5, videoViewCount: 100 }),
      ],
    ]);

    const scored = computeCompositeScores(fused);
    for (const s of scored) {
      expect(s.compositeScore).toBeGreaterThanOrEqual(0);
      expect(s.compositeScore).toBeLessThanOrEqual(1);
    }
  });

  test("multi-source candidates get bonus", () => {
    const semantic = [
      makeCandidate({ id: "a", similarity: 0.8, source: "semantic", videoViewCount: 1000 }),
      makeCandidate({ id: "b", similarity: 0.8, source: "semantic", videoViewCount: 1000 }),
    ];
    const keyword = [
      makeCandidate({ id: "a", similarity: 0, source: "keyword", videoViewCount: 1000 }),
    ];

    const fused = reciprocalRankFusion([semantic, keyword]);
    const scored = computeCompositeScores(fused);

    // 'a' has multi-source bonus, so should score higher than 'b'
    const aScore = scored.find((s) => s.accumulator.candidate.id === "a")!.compositeScore;
    const bScore = scored.find((s) => s.accumulator.candidate.id === "b")!.compositeScore;
    expect(aScore).toBeGreaterThan(bScore);
  });

  test("higher view counts boost score", () => {
    const list = [
      makeCandidate({ id: "a", similarity: 0.8, videoViewCount: 100000, videoId: "v-1" }),
      makeCandidate({ id: "b", similarity: 0.8, videoViewCount: 10, videoId: "v-2" }),
    ];

    const fused = reciprocalRankFusion([list]);
    const scored = computeCompositeScores(fused);

    const aScore = scored.find((s) => s.accumulator.candidate.id === "a")!.compositeScore;
    const bScore = scored.find((s) => s.accumulator.candidate.id === "b")!.compositeScore;
    expect(aScore).toBeGreaterThan(bScore);
  });
});

describe("mmrDiversify", () => {
  test("returns empty for empty input", () => {
    expect(mmrDiversify([], 5)).toEqual([]);
  });

  test("limits results to requested count", () => {
    const list = [
      makeCandidate({ id: "a", videoId: "v-1" }),
      makeCandidate({ id: "b", videoId: "v-2" }),
      makeCandidate({ id: "c", videoId: "v-3" }),
    ];
    const fused = reciprocalRankFusion([list]);
    const scored = computeCompositeScores(fused);
    const results = mmrDiversify(scored, 2);

    expect(results.length).toBe(2);
  });

  test("enforces maxPerVideo limit", () => {
    const list = [
      makeCandidate({ id: "a1", videoId: "v-1", chunkIndex: 0, transcriptId: "t-1", similarity: 0.95 }),
      makeCandidate({ id: "a2", videoId: "v-1", chunkIndex: 1, transcriptId: "t-1", similarity: 0.90 }),
      makeCandidate({ id: "a3", videoId: "v-1", chunkIndex: 2, transcriptId: "t-1", similarity: 0.85 }),
      makeCandidate({ id: "b1", videoId: "v-2", chunkIndex: 0, transcriptId: "t-2", similarity: 0.50 }),
    ];
    const fused = reciprocalRankFusion([list]);
    const scored = computeCompositeScores(fused);
    const results = mmrDiversify(scored, 4, 2);

    const v1Results = results.filter((r) => r.videoId === "v-1");
    expect(v1Results.length).toBeLessThanOrEqual(2);
  });

  test("diversifies across different videos", () => {
    const list = Array.from({ length: 6 }, (_, i) =>
      makeCandidate({
        id: `chunk-${i}`,
        videoId: `v-${i % 3}`,
        transcriptId: `t-${i % 3}`,
        chunkIndex: Math.floor(i / 3),
        similarity: 0.9 - i * 0.05,
        content: `Unique content for chunk ${i} about topic ${i % 3}`,
      }),
    );

    const fused = reciprocalRankFusion([list]);
    const scored = computeCompositeScores(fused);
    const results = mmrDiversify(scored, 4, 2);

    // Should have results from multiple videos
    const uniqueVideos = new Set(results.map((r) => r.videoId));
    expect(uniqueVideos.size).toBeGreaterThan(1);
  });

  test("assigns confidence levels correctly", () => {
    const highSim = [makeCandidate({ id: "high", similarity: 0.85, source: "semantic" })];
    const medSim = [makeCandidate({ id: "med", similarity: 0.55, videoId: "v-2", source: "semantic" })];
    const lowSim = [makeCandidate({ id: "low", similarity: 0.30, videoId: "v-3", source: "semantic" })];

    // High confidence: similarity >= 0.75
    const highFused = reciprocalRankFusion([highSim]);
    const highScored = computeCompositeScores(highFused);
    const highResults = mmrDiversify(highScored, 1);
    expect(highResults[0]!.confidence).toBe("high");

    // Medium confidence: similarity >= 0.50
    const medFused = reciprocalRankFusion([medSim]);
    const medScored = computeCompositeScores(medFused);
    const medResults = mmrDiversify(medScored, 1);
    expect(medResults[0]!.confidence).toBe("medium");
  });

  test("includes all sources in result", () => {
    const semantic = [makeCandidate({ id: "a", source: "semantic" })];
    const keyword = [makeCandidate({ id: "a", source: "keyword" })];

    const fused = reciprocalRankFusion([semantic, keyword]);
    const scored = computeCompositeScores(fused);
    const results = mmrDiversify(scored, 1);

    expect(results[0]!.sources).toContain("semantic");
    expect(results[0]!.sources).toContain("keyword");
  });
});

describe("rerank (full pipeline)", () => {
  test("returns empty for empty input", () => {
    expect(rerank([], 5)).toEqual([]);
  });

  test("end-to-end: fuses, scores, and diversifies", () => {
    const semantic = [
      makeCandidate({ id: "a", similarity: 0.9, videoId: "v-1", source: "semantic" }),
      makeCandidate({ id: "b", similarity: 0.7, videoId: "v-2", source: "semantic" }),
      makeCandidate({ id: "c", similarity: 0.5, videoId: "v-3", source: "semantic" }),
    ];
    const keyword = [
      makeCandidate({ id: "b", similarity: 0, videoId: "v-2", source: "keyword" }),
      makeCandidate({ id: "d", similarity: 0, videoId: "v-4", source: "keyword" }),
    ];

    const results = rerank([semantic, keyword], 3);

    expect(results.length).toBeLessThanOrEqual(3);
    // Each result should have required fields
    for (const r of results) {
      expect(r.content).toBeDefined();
      expect(r.videoTitle).toBeDefined();
      expect(r.score).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(r.confidence);
      expect(r.sources.length).toBeGreaterThan(0);
    }
  });

  test("results are sorted by score descending", () => {
    const list = Array.from({ length: 5 }, (_, i) =>
      makeCandidate({
        id: `c-${i}`,
        videoId: `v-${i}`,
        similarity: 0.9 - i * 0.1,
        source: "semantic",
      }),
    );

    const results = rerank([list], 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });
});
