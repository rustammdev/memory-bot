import { NotFoundError } from "../lib/errors";
import { requireParam } from "../lib/request";
import * as channelRepo from "../repositories/channel.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { extractUsername } from "../yt/parse-channel";
import type { ChannelVideosResponse } from "../yt/types";

export function requireChannelParam(input: string | null): string {
  const trimmed = requireParam(input, "channel");
  return extractUsername(trimmed);
}

export async function resolveChannel(
  input: string | null,
): Promise<channelRepo.ChannelRow | null> {
  const username = requireChannelParam(input);
  return channelRepo.findByUsername(username);
}

export async function requireChannel(
  input: string | null,
): Promise<channelRepo.ChannelRow> {
  const channel = await resolveChannel(input);
  if (!channel) {
    throw new NotFoundError("Channel not found. Sync videos first.");
  }
  return channel;
}

interface PaginationInfo {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

export function toApiResponse(
  channel: channelRepo.ChannelRow,
  videos: ReadonlyArray<videoRepo.VideoRow>,
  metadata: metadataRepo.MetadataRow | null,
  transcribedIds: ReadonlySet<string> = new Set(),
  pagination?: PaginationInfo,
): ChannelVideosResponse {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? videos.length;
  const total = pagination?.total ?? videos.length;

  return {
    channelName: channel.name,
    channelId: channel.youtube_id,
    handle: channel.username,
    avatarUrl: channel.avatar_url,
    bannerUrl: channel.banner_url,
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
      uploadedAt: v.uploaded_at,
      thumbnails: {
        default: v.thumbnail_default,
        medium: v.thumbnail_medium,
        high: v.thumbnail_high,
        maxres: v.thumbnail_maxres,
      },
      tags: v.tags,
      hasTranscript: transcribedIds.has(v.id),
    })),
    page,
    limit,
    hasMore: page * limit < total,
  };
}
