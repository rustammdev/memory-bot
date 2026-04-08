import { Memory, type MemoryItem, type SearchResult } from "mem0ai/oss";
import { createMemoryConfig } from "./config";
import { createLogger } from "../lib/logger";
import type { ChatMessage } from "../types/chat";

const log = createLogger("mem0");

export interface MemoryContext {
  readonly userId: string;
  readonly agentId: string;
}

export interface StructuredMemory {
  readonly memories: string;
  readonly userProfile: string;
}

let instance: Memory | null = null;
let initPromise: Promise<void> | null = null;

function getInstance(): Memory {
  if (!instance) {
    log.info("creating mem0 instance");
    instance = new Memory(createMemoryConfig());
  }
  return instance;
}

async function getReady(): Promise<Memory> {
  const mem = getInstance();
  // mem0 auto-initializes on first operation, but we ensure it's ready
  // by catching init errors explicitly
  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Trigger initialization by calling getAll with a dummy context
        await mem.getAll({ userId: "__init__" });
        log.info("mem0 initialized successfully");
      } catch (err) {
        log.error("mem0 initialization failed", { err: String(err) });
        throw err;
      }
    })();
  }
  await initPromise;
  return mem;
}

export async function saveConversation(
  messages: ReadonlyArray<ChatMessage>,
  ctx: MemoryContext,
): Promise<void> {
  const done = log.time("add");
  try {
    const mem = await getReady();

    // mem0 accepts Message[] with {role, content} — matches ChatMessage
    const result = await mem.add(
      messages.map((m) => ({ role: m.role, content: m.content })),
      { userId: ctx.userId, agentId: ctx.agentId },
    );

    const extracted = result?.results ?? [];
    log.info("memories saved", {
      userId: ctx.userId,
      extracted: extracted.length,
      samples: extracted.slice(0, 2).map((m) => m.memory?.slice(0, 60)),
    });
    done();
  } catch (err) {
    log.error("save failed", { userId: ctx.userId, err: String(err) });
    done();
    throw err;
  }
}

export async function recallMemories(
  query: string,
  ctx: MemoryContext,
  limit = 5,
): Promise<string> {
  try {
    const mem = await getReady();
    const results: SearchResult = await mem.search(query, {
      userId: ctx.userId,
      agentId: ctx.agentId,
      limit,
    });

    const memories: MemoryItem[] = results?.results ?? [];
    log.info("recall", { query: query.slice(0, 50), found: memories.length });

    if (memories.length === 0) return "";

    const lines = memories.map(
      (m, i) => `${i + 1}. ${m.memory}`,
    );
    return `Relevant memories from previous conversations:\n${lines.join("\n")}`;
  } catch (err) {
    log.error("recall failed", { query: query.slice(0, 50), err: String(err) });
    return "";
  }
}

export async function recallStructured(
  query: string,
  ctx: MemoryContext,
): Promise<StructuredMemory> {
  try {
    const mem = await getReady();

    const [searchResults, allMemories] = await Promise.all([
      mem.search(query, { userId: ctx.userId, agentId: ctx.agentId, limit: 5 }),
      mem.getAll({ userId: ctx.userId, agentId: ctx.agentId }),
    ]);

    const relevant: MemoryItem[] = searchResults?.results ?? [];
    const all: MemoryItem[] = allMemories?.results ?? [];

    const memories = relevant.length > 0
      ? relevant.map((m, i) => `${i + 1}. ${m.memory}`).join("\n")
      : "";

    const userProfile = buildUserProfile(all);

    log.info("structured recall", {
      query: query.slice(0, 50),
      relevant: relevant.length,
      total: all.length,
      hasProfile: userProfile.length > 0,
    });

    return { memories, userProfile };
  } catch (err) {
    log.error("structured recall failed", { err: String(err) });
    return { memories: "", userProfile: "" };
  }
}

function buildUserProfile(
  allMemories: ReadonlyArray<MemoryItem>,
): string {
  if (allMemories.length === 0) return "";

  const texts = allMemories.map((m) => m.memory.toLowerCase());

  const interests = extractTopics(texts);
  const skillIndicators = detectSkillLevel(texts);

  const lines: string[] = [];

  lines.push(`- Conversations so far: ${allMemories.length} remembered facts`);

  if (skillIndicators.level !== "unknown") {
    lines.push(`- Apparent skill level: ${skillIndicators.level} (${skillIndicators.reason})`);
  }

  if (interests.length > 0) {
    lines.push(`- Topics they've asked about: ${interests.join(", ")}`);
  }

  return lines.join("\n");
}

function extractTopics(texts: ReadonlyArray<string>): string[] {
  const topicCounts = new Map<string, number>();

  const techTerms = /\b(react|typescript|javascript|python|node|css|html|vue|angular|svelte|next|docker|kubernetes|aws|git|sql|api|rest|graphql|ai|ml|llm|rust|go|java|kotlin|swift)\b/g;

  for (const text of texts) {
    techTerms.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = techTerms.exec(text)) !== null) {
      const topic = match[0];
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
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
): Promise<ReadonlyArray<MemoryItem>> {
  try {
    const mem = await getReady();
    const all = await mem.getAll({
      userId: ctx.userId,
      agentId: ctx.agentId,
    });
    return all?.results ?? [];
  } catch (err) {
    log.error("getUserMemories failed", { err: String(err) });
    return [];
  }
}
