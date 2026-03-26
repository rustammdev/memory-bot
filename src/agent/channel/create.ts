import { createAgent } from "langchain";
import { createChannelTools } from "./tools";
import { buildSystemPrompt } from "./prompt";
import * as metadataRepo from "../../repositories/metadata.repo";
import type { ChannelRow } from "../../repositories/channel.repo";
import {
  model,
  getCached,
  putCached,
  type AgentInstance,
} from "../shared";

export async function getChannelAgent(
  channel: ChannelRow,
): Promise<AgentInstance> {
  const cached = getCached(channel.id);
  if (cached) return cached;

  const metadata = await metadataRepo.findLatest(channel.id);
  const tools = createChannelTools(channel.id);
  const systemPrompt = buildSystemPrompt(channel, metadata);
  const agent = createAgent({ model, tools, systemPrompt });
  const configured = agent.withConfig({ recursionLimit: 12 });

  putCached(channel.id, configured);
  return configured;
}
