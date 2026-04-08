import { createAgent } from "langchain";
import { createChannelTools } from "./tools";
import { buildSystemPrompt, type MemoryContext } from "./prompt";
import * as metadataRepo from "../../repositories/metadata.repo";
import type { ChannelRow } from "../../repositories/channel.repo";
import type { StructuredMemory } from "../../memory/client";
import {
  model,
  getCached,
  putCached,
  type AgentInstance,
} from "../shared";

export async function getChannelAgent(
  channel: ChannelRow,
  memory?: StructuredMemory | null,
): Promise<AgentInstance> {
  // When memory is present, create a fresh agent with personalized prompt
  // When no memory, use cached generic agent
  const hasMemory = memory && (memory.memories.length > 0 || memory.userProfile.length > 0);

  if (!hasMemory) {
    const cached = getCached(channel.id);
    if (cached) return cached;
  }

  const metadata = await metadataRepo.findLatest(channel.id);
  const tools = createChannelTools(channel.id);

  const memoryCtx: MemoryContext | null = hasMemory
    ? { memories: memory!.memories, userProfile: memory!.userProfile }
    : null;

  const systemPrompt = buildSystemPrompt(channel, metadata, memoryCtx);
  const agent = createAgent({ model, tools, systemPrompt });
  const configured = agent.withConfig({ recursionLimit: 12 });

  if (!hasMemory) {
    putCached(channel.id, configured);
  }

  return configured;
}
