import { ValidationError } from "../lib/errors";
import * as channelRepo from "../repositories/channel.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { extractUsername } from "../yt/parse-channel";
import type { ChannelVideosResponse } from "../yt/types";

export function requireChannelParam(input: string | null): string {
  if (!input || input.trim().length === 0) {
    throw new ValidationError("\"channel\" query parameter is required");
  }
  return extractUsername(input);
}

export async function resolveChannel(
  input: string | null,
): Promise<channelRepo.ChannelRow | null> {
  const username = requireChannelParam(input);
  return channelRepo.findByUsername(username);
}

export function toApiResponse(
  channel: channelRepo.ChannelRow,
  videos: ReadonlyArray<videoRepo.VideoRow>,
  metadata: metadataRepo.MetadataRow | null,
): ChannelVideosResponse {
  return {
    channelName: channel.name,
    channelId: channel.youtube_id,
    handle: channel.username,
    totalVideos: channel.video_count,
    metadata: metadata
      ? {
          version: metadata.version,
          overview: metadata.overview,
          associatedVideoTypes: metadata.associated_video_types,
          category: metadata.category,
          language: metadata.language,
        }
      : null,
    videos: videos.map((v) => ({
      id: v.youtube_video_id,
      title: v.title,
      url: v.url,
      viewCount: v.view_count,
      duration: v.duration_sec,
      durationFormatted: v.duration_formatted,
    })),
  };
}
