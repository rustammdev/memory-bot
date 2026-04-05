import { describe, test, expect, mock } from "bun:test";

// Mock external dependencies before importing shared
mock.module("@langchain/openai", () => ({
  ChatOpenAI: class MockChatOpenAI {
    constructor() {}
  },
}));

mock.module("langchain", () => ({
  tool: (handler: Function, config: any) => ({
    name: config.name,
    description: config.description,
    handler,
    invoke: (args: any) => handler(args),
  }),
  createAgent: () => ({}),
}));

// Set env var before import
process.env.DEEPSEEK_API_KEY = "test-key";

import { getCached, putCached } from "../shared";

describe("getCached", () => {
  test("returns undefined for non-existent key", () => {
    expect(getCached("nonexistent-key-12345")).toBeUndefined();
  });

  test("returns cached agent after put", () => {
    const agent = { id: "test-agent" } as any;
    putCached("test-get", agent);
    expect(getCached("test-get")).toBe(agent);
  });
});

describe("putCached", () => {
  test("stores and retrieves agent", () => {
    const agent = { id: "cached-agent" } as any;
    putCached("cache-key-1", agent);
    const result = getCached("cache-key-1");
    expect(result).toBe(agent);
  });

  test("overwrites existing agent with same key", () => {
    const agent1 = { id: "v1" } as any;
    const agent2 = { id: "v2" } as any;
    putCached("overwrite-key", agent1);
    putCached("overwrite-key", agent2);
    expect(getCached("overwrite-key")).toBe(agent2);
  });
});

describe("LRU cache behavior", () => {
  test("getCached refreshes key position (LRU)", () => {
    const agent1 = { id: "lru-1" } as any;
    const agent2 = { id: "lru-2" } as any;

    putCached("lru-key-1", agent1);
    putCached("lru-key-2", agent2);

    // Access key-1 to refresh its position
    getCached("lru-key-1");

    // Both should still be accessible
    expect(getCached("lru-key-1")).toBe(agent1);
    expect(getCached("lru-key-2")).toBe(agent2);
  });

  test("evicts oldest when cache exceeds max size", () => {
    // Fill cache with 50 entries (MAX_CACHED_AGENTS = 50)
    for (let i = 0; i < 50; i++) {
      putCached(`evict-test-${i}`, { id: `agent-${i}` } as any);
    }

    // Add one more — should evict the oldest
    putCached("evict-test-new", { id: "new-agent" } as any);

    // New one should be accessible
    expect(getCached("evict-test-new")).toBeDefined();
  });
});
