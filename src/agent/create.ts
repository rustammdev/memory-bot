import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createChannelTools } from "./tools";
import { buildSystemPrompt } from "./prompt";
import type { ChannelRow } from "../repositories/channel.repo";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

const model = new ChatOpenAI({
  modelName: "deepseek-chat",
  configuration: { baseURL: DEEPSEEK_BASE_URL },
  apiKey: DEEPSEEK_API_KEY,
  temperature: 0.3,
});

type AgentInstance = ReturnType<typeof createAgent>;

const MAX_CACHED_AGENTS = 50;
const agentCache = new Map<string, AgentInstance>();

function putCached(key: string, agent: AgentInstance): void {
  if (agentCache.size >= MAX_CACHED_AGENTS) {
    const oldest = agentCache.keys().next().value;
    if (oldest !== undefined) agentCache.delete(oldest);
  }
  agentCache.set(key, agent);
}

export function getChannelAgent(channel: ChannelRow): AgentInstance {
  const cached = agentCache.get(channel.id);
  if (cached) return cached;

  const tools = createChannelTools(channel.id);
  const systemPrompt = buildSystemPrompt(channel.name, channel.username);
  const agent = createAgent({ model, tools, systemPrompt });

  putCached(channel.id, agent);
  return agent;
}
