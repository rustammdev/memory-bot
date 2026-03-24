import { ValidationError } from "../lib/errors";
import { fetchChannelVideos } from "../yt/fetch-videos";
import type { ChannelVideosResponse } from "../yt/types";

export async function getChannelVideos(
  channel: unknown,
): Promise<ChannelVideosResponse> {
  if (!channel || typeof channel !== "string") {
    throw new ValidationError("\"channel\" field is required (string)");
  }

  const trimmed = channel.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("\"channel\" must not be empty");
  }

  return fetchChannelVideos(trimmed);
}
