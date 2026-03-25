import { Memory } from "mem0ai/oss";
import { createMemoryConfig } from "./config";
import type { ChatMessage } from "../types/chat";

interface MemoryEntry {
  readonly id: string;
  readonly memory: string;
}

interface MemoryContext {
  readonly userId: string;
  readonly agentId: string;
}

// Singleton. mem0ai manages the underlying pgvector connection pool internally.
// No explicit teardown needed — the pool is released on process exit.
let instance: Memory | null = null;

export function getMemory(): Memory {
  if (!instance) {
    instance = new Memory(createMemoryConfig());
  }
  return instance;
}

export async function saveConversation(
  messages: ReadonlyArray<ChatMessage>,
  ctx: MemoryContext,
): Promise<void> {
  const mem = getMemory();
  await mem.add([...messages], {
    userId: ctx.userId,
    agentId: ctx.agentId,
  });
}

export async function recallMemories(
  query: string,
  ctx: MemoryContext,
  limit = 5,
): Promise<string> {
  const mem = getMemory();
  const results = await mem.search(query, {
    userId: ctx.userId,
    agentId: ctx.agentId,
    limit,
  });

  const memories: MemoryEntry[] = results?.results ?? [];
  if (memories.length === 0) return "";

  const lines = memories.map(
    (m, i) => `${i + 1}. ${m.memory}`,
  );
  return `Relevant memories from previous conversations:\n${lines.join("\n")}`;
}

export async function getUserMemories(
  ctx: MemoryContext,
): Promise<ReadonlyArray<MemoryEntry>> {
  const mem = getMemory();
  const all = await mem.getAll({
    userId: ctx.userId,
    agentId: ctx.agentId,
  });
  return (all?.results ?? []).map((m: MemoryEntry) => ({
    id: m.id,
    memory: m.memory,
  }));
}
