import { ValidationError } from "../lib/errors";
import * as channelRepo from "../repositories/channel.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { fetchChannelVideos } from "../yt/fetch-videos";
import { extractUsername } from "../yt/parse-channel";
import type { ChannelVideosResponse } from "../yt/types";

function toApiResponse(
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

export async function getChannelVideos(
  channelInput: string | null,
): Promise<ChannelVideosResponse> {
  if (!channelInput || channelInput.trim().length === 0) {
    throw new ValidationError("\"channel\" query parameter is required");
  }

  const username = extractUsername(channelInput);

  const existing = await channelRepo.findByUsername(username);
  if (existing) {
    const [videos, metadata] = await Promise.all([
      videoRepo.findByChannelId(existing.id),
      metadataRepo.findLatest(existing.id),
    ]);
    return toApiResponse(existing, videos, metadata);
  }

  const ytData = await fetchChannelVideos(channelInput);

  const channel = await channelRepo.upsert({
    youtubeId: ytData.channelId,
    username: ytData.handle,
    name: ytData.channelName,
    videoCount: ytData.totalVideos,
  });

  await videoRepo.bulkUpsert(
    ytData.videos.map((v) => ({
      channelId: channel.id,
      youtubeVideoId: v.id,
      title: v.title,
      url: v.url,
      viewCount: v.viewCount ?? 0,
      durationSec: v.duration,
      durationFormatted: v.durationFormatted,
    })),
  );

  const videos = await videoRepo.findByChannelId(channel.id);
  return toApiResponse(channel, videos, null);
}

export async function getChannelMetadata(
  channelInput: string | null,
  version?: number,
) {
  if (!channelInput || channelInput.trim().length === 0) {
    throw new ValidationError("\"channel\" query parameter is required");
  }

  const username = extractUsername(channelInput);
  const channel = await channelRepo.findByUsername(username);
  if (!channel) {
    return { metadata: null, message: "Channel not found. Sync videos first." };
  }

  if (version !== undefined) {
    const metadata = await metadataRepo.findByVersion(channel.id, version);
    return { metadata };
  }

  const metadata = await metadataRepo.findLatest(channel.id);
  return {
    metadata,
    message: metadata ? undefined : "Metadata not generated yet. Needs first transcript.",
  };
}

export async function getChannelMetadataVersions(
  channelInput: string | null,
) {
  if (!channelInput || channelInput.trim().length === 0) {
    throw new ValidationError("\"channel\" query parameter is required");
  }

  const username = extractUsername(channelInput);
  const channel = await channelRepo.findByUsername(username);
  if (!channel) {
    return { versions: [] };
  }

  const versions = await metadataRepo.findAll(channel.id);
  return { versions };
}
