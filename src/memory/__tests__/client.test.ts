import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockSearch = mock(async () => ({
  results: [
    { id: "m1", memory: "User asked about React hooks", score: 0.9 },
    { id: "m2", memory: "User is interested in TypeScript", score: 0.8 },
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

const mockAdd = mock(async () => ({ results: [{ id: "new-1", memory: "extracted" }] }));

mock.module("mem0ai/oss", () => ({
  Memory: class MockMemory {
    search = mockSearch;
    getAll = mockGetAll;
    add = mockAdd;
  },
}));

mock.module("../config", () => ({
  createMemoryConfig: () => ({
    version: "v1.1",
    llm: { provider: "openai", config: {} },
    embedder: { provider: "openai", config: {} },
    vectorStore: { provider: "pgvector", config: {} },
  }),
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

const {
  recallStructured,
  recallMemories,
  saveConversation,
  getUserMemories,
} = await import("../client");

beforeEach(() => {
  mockSearch.mockClear();
  mockGetAll.mockClear();
  mockAdd.mockClear();
});

describe("saveConversation", () => {
  test("calls mem0 add with messages and context", async () => {
    await saveConversation(
      [
        { role: "user", content: "What is React?" },
        { role: "assistant", content: "React is a UI library." },
      ],
      { userId: "u1", agentId: "a1" },
    );

    expect(mockAdd).toHaveBeenCalledTimes(1);
    const [messages, opts] = mockAdd.mock.calls[0]!;
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What is React?");
    expect(opts.userId).toBe("u1");
    expect(opts.agentId).toBe("a1");
  });
});

describe("recallMemories", () => {
  test("returns formatted memory string", async () => {
    const result = await recallMemories("React", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result).toContain("Relevant memories");
    expect(result).toContain("React hooks");
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  test("returns empty string when no memories", async () => {
    mockSearch.mockResolvedValueOnce({ results: [] });

    const result = await recallMemories("nonexistent", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result).toBe("");
  });

  test("returns empty string on error", async () => {
    mockSearch.mockRejectedValueOnce(new Error("DB down"));

    const result = await recallMemories("test", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result).toBe("");
  });
});

describe("recallStructured", () => {
  test("returns memories and user profile", async () => {
    const result = await recallStructured("React hooks", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result.memories).toContain("React hooks");
    expect(result.userProfile).toBeDefined();
    expect(result.userProfile.length).toBeGreaterThan(0);
  });

  test("extracts tech topics from memory history", async () => {
    const result = await recallStructured("test", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result.userProfile).toContain("Topics they've asked about");
    expect(result.userProfile).toMatch(/react|typescript|javascript/);
  });

  test("detects skill level from memory patterns", async () => {
    const result = await recallStructured("test", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result.userProfile).toContain("skill level");
  });

  test("includes conversation count", async () => {
    const result = await recallStructured("test", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result.userProfile).toContain("5 remembered facts");
  });

  test("returns empty profile for new user", async () => {
    mockGetAll.mockResolvedValueOnce({ results: [] });
    mockSearch.mockResolvedValueOnce({ results: [] });

    const result = await recallStructured("test", {
      userId: "new-user",
      agentId: "a1",
    });

    expect(result.memories).toBe("");
    expect(result.userProfile).toBe("");
  });

  test("returns empty on error (graceful degradation)", async () => {
    mockSearch.mockRejectedValueOnce(new Error("timeout"));
    mockGetAll.mockRejectedValueOnce(new Error("timeout"));

    const result = await recallStructured("test", {
      userId: "u1",
      agentId: "a1",
    });

    expect(result.memories).toBe("");
    expect(result.userProfile).toBe("");
  });
});

describe("getUserMemories", () => {
  test("returns all memories for user", async () => {
    const memories = await getUserMemories({
      userId: "u1",
      agentId: "a1",
    });

    expect(memories.length).toBe(5);
    expect(memories[0]!.memory).toContain("React hooks");
  });

  test("returns empty array on error", async () => {
    mockGetAll.mockRejectedValueOnce(new Error("DB down"));

    const memories = await getUserMemories({
      userId: "u1",
      agentId: "a1",
    });

    expect(memories).toEqual([]);
  });
});
