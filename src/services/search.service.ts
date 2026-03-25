import { requireParam } from "../lib/request";
import { requireChannel } from "./channel.helpers";
import { embedText } from "../vector/embedder";
import { searchByChannel, type SearchResult } from "../vector/store";

export { type SearchResult };

export async function searchByChannelId(
  channelId: string,
  query: string,
  limit = 5,
): Promise<ReadonlyArray<SearchResult>> {
  const queryEmbedding = await embedText(query);
  return searchByChannel(channelId, queryEmbedding, limit);
}

export async function searchChannelContent(
  channelInput: string | null,
  query: string | null,
  limit = 5,
): Promise<ReadonlyArray<SearchResult>> {
  const channel = await requireChannel(channelInput);
  const queryText = requireParam(query, "q");
  return searchByChannelId(channel.id, queryText, limit);
}
