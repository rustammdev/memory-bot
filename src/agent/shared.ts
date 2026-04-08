import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export const model = new ChatOpenAI({
  modelName: "deepseek-reasoner",
  configuration: { baseURL: DEEPSEEK_BASE_URL },
  apiKey: DEEPSEEK_API_KEY,
});

export type AgentInstance = ReturnType<typeof createAgent>;

const MAX_CACHED_AGENTS = 50;
const agentCache = new Map<string, AgentInstance>();

export function getCached(key: string): AgentInstance | undefined {
  const agent = agentCache.get(key);
  if (agent) {
    agentCache.delete(key);
    agentCache.set(key, agent);
  }
  return agent;
}

export function putCached(key: string, agent: AgentInstance): void {
  if (agentCache.size >= MAX_CACHED_AGENTS) {
    const oldest = agentCache.keys().next().value;
    if (oldest !== undefined) agentCache.delete(oldest);
  }
  agentCache.set(key, agent);
}
