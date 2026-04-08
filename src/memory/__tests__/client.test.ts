import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock mem0ai before any imports
const mockSearch = mock(async () => ({
  results: [
    { id: "m1", memory: "User asked about React hooks" },
    { id: "m2", memory: "User is interested in TypeScript" },
  ],
}));

const mockGetAll = mock(async () => ({
  results: [
    { id: "m1", memory: "User asked about React hooks" },
    { id: "m2", memory: "User is interested in TypeScript" },
    { id: "m3", memory: "User wants to learn about architecture and design patterns" },
    { id: "m4", memory: "User asked basic questions about what is JavaScript" },
    { id: "m5", memory: "User discussed optimization and performance" },
  ],
}));

const mockAdd = mock(async () => ({ results: [] }));

mock.module("mem0ai/oss", () => ({
  Memory: class MockMemory {
    search = mockSearch;
    getAll = mockGetAll;
    add = mockAdd;
  },
}));

mock.module("../config", () => ({
  createMemoryConfig: () => ({}),
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

const { recallStructured, recallMemories } = await import("../client");

beforeEach(() => {
  mockSearch.mockClear();
  mockGetAll.mockClear();
});

describe("recallStructured", () => {
  test("returns memories and user profile", async () => {
    const result = await recallStructured("React hooks", {
      userId: "user-1",
      agentId: "agent-1",
    });

    expect(result.memories).toContain("React hooks");
    expect(result.userProfile).toBeDefined();
  });

  test("extracts topics from memory history", async () => {
    const result = await recallStructured("test", {
      userId: "user-1",
      agentId: "agent-1",
    });

    // Should extract topics like "react", "typescript" from the mock memories
    expect(result.userProfile).toContain("Topics they've asked about");
  });

  test("detects skill level from memory patterns", async () => {
    const result = await recallStructured("test", {
      userId: "user-1",
      agentId: "agent-1",
    });

    // Mock data has both beginner ("what is") and advanced ("architecture", "optimization") signals
    expect(result.userProfile).toContain("skill level");
  });

  test("includes conversation count", async () => {
    const result = await recallStructured("test", {
      userId: "user-1",
      agentId: "agent-1",
    });

    expect(result.userProfile).toContain("5 remembered facts");
  });

  test("returns empty profile for no memories", async () => {
    mockGetAll.mockResolvedValueOnce({ results: [] });
    mockSearch.mockResolvedValueOnce({ results: [] });

    const result = await recallStructured("test", {
      userId: "new-user",
      agentId: "agent-1",
    });

    expect(result.memories).toBe("");
    expect(result.userProfile).toBe("");
  });
});

describe("recallMemories (legacy)", () => {
  test("returns formatted memory string", async () => {
    const result = await recallMemories("React", {
      userId: "user-1",
      agentId: "agent-1",
    });

    expect(result).toContain("Relevant memories");
    expect(result).toContain("React hooks");
  });

  test("returns empty string when no memories", async () => {
    mockSearch.mockResolvedValueOnce({ results: [] });

    const result = await recallMemories("nonexistent", {
      userId: "user-1",
      agentId: "agent-1",
    });

    expect(result).toBe("");
  });
});
