import { describe, test, expect } from "bun:test";
import { clusterEmbeddings, type EmbeddingRecord } from "../cluster";

function makeRecord(
  id: string,
  embedding: number[],
  videoTitle = "Test Video",
): EmbeddingRecord {
  return { id, videoId: `vid-${id}`, embedding, videoTitle };
}

// Create a simple 3D embedding for testing
function makeSimpleEmbedding(x: number, y: number, z: number): number[] {
  return [x, y, z];
}

describe("clusterEmbeddings", () => {
  test("returns empty array for empty input", () => {
    const result = clusterEmbeddings([]);
    expect(result).toEqual([]);
  });

  test("returns single cluster for < 5 records", () => {
    const records = [
      makeRecord("1", makeSimpleEmbedding(1, 0, 0)),
      makeRecord("2", makeSimpleEmbedding(0, 1, 0)),
      makeRecord("3", makeSimpleEmbedding(0, 0, 1)),
    ];

    const result = clusterEmbeddings(records);
    expect(result.length).toBe(1);
    expect(result[0]!.clusterId).toBe(0);
    expect(result[0]!.records.length).toBe(3);
  });

  test("single record returns single cluster", () => {
    const records = [makeRecord("1", makeSimpleEmbedding(1, 0, 0))];
    const result = clusterEmbeddings(records);
    expect(result.length).toBe(1);
    expect(result[0]!.records.length).toBe(1);
  });

  test("4 records returns single cluster", () => {
    const records = [
      makeRecord("1", makeSimpleEmbedding(1, 0, 0)),
      makeRecord("2", makeSimpleEmbedding(0, 1, 0)),
      makeRecord("3", makeSimpleEmbedding(0, 0, 1)),
      makeRecord("4", makeSimpleEmbedding(1, 1, 0)),
    ];
    const result = clusterEmbeddings(records);
    expect(result.length).toBe(1);
  });

  test("clusters well-separated groups", () => {
    // Group A: embeddings near [1,0,0]
    // Group B: embeddings near [0,1,0]
    const records = [
      makeRecord("a1", [1, 0.01, 0]),
      makeRecord("a2", [0.99, 0.02, 0]),
      makeRecord("a3", [0.98, 0, 0.01]),
      makeRecord("a4", [1, 0.01, 0.01]),
      makeRecord("a5", [0.97, 0.02, 0]),
      makeRecord("b1", [0, 1, 0.01]),
      makeRecord("b2", [0.01, 0.99, 0]),
      makeRecord("b3", [0, 0.98, 0.02]),
      makeRecord("b4", [0.01, 1, 0]),
      makeRecord("b5", [0.02, 0.97, 0.01]),
    ];

    const result = clusterEmbeddings(records, 2);
    expect(result.length).toBe(2);

    // Total records across clusters should equal input
    const totalRecords = result.reduce((sum, c) => sum + c.records.length, 0);
    expect(totalRecords).toBe(10);
  });

  test("respects explicit k parameter", () => {
    const records = Array.from({ length: 30 }, (_, i) =>
      makeRecord(`r${i}`, [Math.cos(i), Math.sin(i), i / 30]),
    );

    const result = clusterEmbeddings(records, 5);
    // Should have at most 5 clusters
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.length).toBeGreaterThan(0);
  });

  test("cluster assignments have valid structure", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord(`r${i}`, [Math.cos(i), Math.sin(i), 0]),
    );

    const result = clusterEmbeddings(records, 3);
    for (const cluster of result) {
      expect(typeof cluster.clusterId).toBe("number");
      expect(Array.isArray(cluster.records)).toBe(true);
      expect(Array.isArray(cluster.centroid)).toBe(true);
      expect(cluster.centroid.length).toBe(3); // same dims as input
      expect(cluster.records.length).toBeGreaterThan(0);
    }
  });

  test("clusters sorted by size descending", () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      makeRecord(`r${i}`, [Math.cos(i * 0.5), Math.sin(i * 0.5), i / 20]),
    );

    const result = clusterEmbeddings(records, 4);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.records.length).toBeGreaterThanOrEqual(
        result[i]!.records.length,
      );
    }
  });

  test("all records are assigned to exactly one cluster", () => {
    const records = Array.from({ length: 15 }, (_, i) =>
      makeRecord(`r${i}`, [i / 15, 1 - i / 15, 0.5]),
    );

    const result = clusterEmbeddings(records, 3);
    const allIds = result.flatMap((c) => c.records.map((r) => r.id));
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(15);
    expect(allIds.length).toBe(15);
  });

  test("handles identical embeddings", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord(`r${i}`, [1, 0, 0]),
    );

    const result = clusterEmbeddings(records, 3);
    const totalRecords = result.reduce((sum, c) => sum + c.records.length, 0);
    expect(totalRecords).toBe(10);
  });
});
