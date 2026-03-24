import { NotFoundError } from "../lib/errors";
import * as channelRepo from "../repositories/channel.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { fetchChannelVideos } from "../yt/fetch-videos";
import { resolveChannel, toApiResponse } from "./channel.helpers";
import type { ChannelVideosResponse } from "../yt/types";

interface MetadataResponse {
  readonly metadata: metadataRepo.MetadataRow | null;
  readonly message?: string;
}

interface MetadataVersionsResponse {
  readonly versions: ReadonlyArray<metadataRepo.MetadataRow>;
}

export async function getChannelVideos(
  channelInput: string | null,
): Promise<ChannelVideosResponse> {
  const existing = await resolveChannel(channelInput);
  if (existing) {
    const [videos, metadata] = await Promise.all([
      videoRepo.findByChannelId(existing.id),
      metadataRepo.findLatest(existing.id),
    ]);
    return toApiResponse(existing, videos, metadata);
  }

  const ytData = await fetchChannelVideos(channelInput!);

  const channel = await channelRepo.upsert({
    youtubeId: ytData.channelId,
    username: ytData.handle,
    name: ytData.channelName,
    videoCount: ytData.totalVideos,
  });

  const videos = await videoRepo.bulkUpsert(
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

  return toApiResponse(channel, videos, null);
}

export async function getChannelMetadata(
  channelInput: string | null,
  version?: number,
): Promise<MetadataResponse> {
  const channel = await resolveChannel(channelInput);
  if (!channel) {
    throw new NotFoundError("Channel not found. Sync videos first.");
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
): Promise<MetadataVersionsResponse> {
  const channel = await resolveChannel(channelInput);
  if (!channel) {
    throw new NotFoundError("Channel not found. Sync videos first.");
  }

  const versions = await metadataRepo.findAll(channel.id);
  return { versions };
}
