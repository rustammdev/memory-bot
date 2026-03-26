import { createAgent } from "langchain";
import { createMultiChannelTools } from "./tools";
import { buildMultiChannelPrompt } from "./prompt";
import * as metadataRepo from "../../repositories/metadata.repo";
import type { ChannelRow } from "../../repositories/channel.repo";
import type { MetadataRow } from "../../repositories/metadata.repo";
import {
  model,
  getCached,
  putCached,
  type AgentInstance,
} from "../shared";

function buildCacheKey(channels: ReadonlyArray<ChannelRow>): string {
  return `multi:${[...channels].map((c) => c.id).sort().join("|")}`;
}

export async function getMultiChannelAgent(
  channels: ReadonlyArray<ChannelRow>,
): Promise<AgentInstance> {
  const cacheKey = buildCacheKey(channels);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const metadataResults = await Promise.all(
    channels.map((ch) => metadataRepo.findLatest(ch.id)),
  );

  const channelsByUsername = new Map<string, ChannelRow>(
    channels.map((ch) => [ch.username, ch]),
  );
  const metadataByChannelId = new Map<string, MetadataRow | null>(
    channels.map((ch, i) => [ch.id, metadataResults[i] ?? null]),
  );

  const channelSummaries = channels.map((ch, i) => ({
    name: ch.name,
    username: ch.username,
    category: metadataResults[i]?.category ?? "other",
  }));

  const channelIds = channels.map((ch) => ch.id);
  const tools = createMultiChannelTools({
    channelIds,
    channelsByUsername,
    metadataByChannelId,
  });
  const systemPrompt = buildMultiChannelPrompt(channelSummaries);
  const agent = createAgent({ model, tools, systemPrompt });
  const configured = agent.withConfig({ recursionLimit: 15 });

  putCached(cacheKey, configured);
  return configured;
}
