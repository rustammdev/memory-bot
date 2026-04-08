import { Memory } from "mem0ai/oss";
import { createMemoryConfig } from "./config";
import { createLogger } from "../lib/logger";
import type { ChatMessage } from "../types/chat";

const log = createLogger("mem0");

interface MemoryEntry {
  readonly id: string;
  readonly memory: string;
}

export interface MemoryContext {
  readonly userId: string;
  readonly agentId: string;
}

export interface StructuredMemory {
  readonly memories: string;
  readonly userProfile: string;
}

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
  const done = log.time("add");
  const mem = getMemory();
  const result = await mem.add([...messages], {
    userId: ctx.userId,
    agentId: ctx.agentId,
  });
  log.debug("add result", { extracted: result?.results?.length ?? 0 });
  done();
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
  log.debug("search", { query: query.slice(0, 50), found: memories.length });
  if (memories.length === 0) return "";

  const lines = memories.map(
    (m, i) => `${i + 1}. ${m.memory}`,
  );
  return `Relevant memories from previous conversations:\n${lines.join("\n")}`;
}

export async function recallStructured(
  query: string,
  ctx: MemoryContext,
): Promise<StructuredMemory> {
  const mem = getMemory();

  const [searchResults, allMemories] = await Promise.all([
    mem.search(query, { userId: ctx.userId, agentId: ctx.agentId, limit: 5 }),
    mem.getAll({ userId: ctx.userId, agentId: ctx.agentId }),
  ]);

  const relevant: MemoryEntry[] = searchResults?.results ?? [];
  const all: MemoryEntry[] = allMemories?.results ?? [];

  log.debug("structured recall", {
    query: query.slice(0, 50),
    relevant: relevant.length,
    total: all.length,
  });

  const memories = relevant.length > 0
    ? relevant.map((m, i) => `${i + 1}. ${m.memory}`).join("\n")
    : "";

  const userProfile = buildUserProfile(all);

  return { memories, userProfile };
}

function buildUserProfile(
  allMemories: ReadonlyArray<MemoryEntry>,
): string {
  if (allMemories.length === 0) return "";

  const texts = allMemories.map((m) => m.memory.toLowerCase());

  const interests = extractTopics(texts);
  const skillIndicators = detectSkillLevel(texts);
  const interactionCount = allMemories.length;

  const lines: string[] = [];

  if (interactionCount > 0) {
    lines.push(`- Conversations so far: ${interactionCount} remembered facts`);
  }

  if (skillIndicators.level !== "unknown") {
    lines.push(`- Apparent skill level: ${skillIndicators.level} (${skillIndicators.reason})`);
  }

  if (interests.length > 0) {
    lines.push(`- Topics they've asked about: ${interests.join(", ")}`);
  }

  return lines.length > 0
    ? lines.join("\n")
    : "";
}

function extractTopics(texts: ReadonlyArray<string>): string[] {
  const topicCounts = new Map<string, number>();

  const patterns = [
    /(?:asked|interested|wants?|learning|about|discussed|likes?)\s+(\w[\w\s]{2,20})/g,
    /(?:react|typescript|javascript|python|node|css|html|vue|angular|svelte|next|docker|kubernetes|aws|git|sql|api|rest|graphql|ai|ml|llm)/g,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const topic = (match[1] ?? match[0]).trim().toLowerCase();
        if (topic.length > 2) {
          topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
        }
      }
    }
  }

  return Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}

function detectSkillLevel(
  texts: ReadonlyArray<string>,
): { level: "beginner" | "intermediate" | "advanced" | "unknown"; reason: string } {
  const beginnerSignals = [
    "beginner", "new to", "just started", "learning", "how to start",
    "what is", "explain", "simple", "basic", "boshlang'ich", "yangi",
    "tushuntir", "oddiy", "nima",
  ];

  const advancedSignals = [
    "architecture", "optimization", "performance", "scaling", "design pattern",
    "refactor", "microservice", "ci/cd", "deployment", "benchmark",
    "arxitektura", "optimallashtirish",
  ];

  let beginnerScore = 0;
  let advancedScore = 0;

  for (const text of texts) {
    for (const signal of beginnerSignals) {
      if (text.includes(signal)) beginnerScore++;
    }
    for (const signal of advancedSignals) {
      if (text.includes(signal)) advancedScore++;
    }
  }

  if (advancedScore >= 3) return { level: "advanced", reason: "asks about architecture, optimization, design patterns" };
  if (beginnerScore >= 3) return { level: "beginner", reason: "asks introductory/explanatory questions" };
  if (advancedScore > 0 && beginnerScore > 0) return { level: "intermediate", reason: "mix of basic and advanced questions" };
  if (advancedScore > 0) return { level: "intermediate", reason: "some advanced topics" };
  if (beginnerScore > 0) return { level: "beginner", reason: "asks explanatory questions" };

  return { level: "unknown", reason: "" };
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
