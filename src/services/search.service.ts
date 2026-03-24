import { requireParam } from "../lib/request";
import { requireChannel } from "./channel.helpers";
import { embedText } from "../vector/embedder";
import { searchByChannel, type SearchResult } from "../vector/store";

export async function searchChannelContent(
  channelInput: string | null,
  query: string | null,
  limit = 5,
): Promise<ReadonlyArray<SearchResult>> {
  const channel = await requireChannel(channelInput);
  const queryText = requireParam(query, "q");

  const queryEmbedding = await embedText(queryText);
  return searchByChannel(channel.id, queryEmbedding, limit);
}
