import { NotFoundError } from "../lib/errors";
import * as channelRepo from "../repositories/channel.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import * as transcriptRepo from "../repositories/transcript.repo";
import { generateChannelMetadata, type GeneratedMetadata } from "../ai/generate-metadata";
import { fetchChannelImages } from "../yt/fetch-channel-images";
import { fetchChannelVideos } from "../yt/fetch-videos";
import { requireChannel, resolveChannel, toApiResponse } from "./channel.helpers";
import type { ChannelVideosResponse } from "../yt/types";

interface MetadataResponse {
  readonly channelName: string;
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
  readonly metadata: metadataRepo.MetadataRow | null;
  readonly message?: string;
}

interface MetadataVersionsResponse {
  readonly versions: ReadonlyArray<metadataRepo.MetadataRow>;
}

interface VideosFilter {
  readonly transcribedOnly?: boolean;
}

function toMetadataInsert(
  channelId: string,
  generated: GeneratedMetadata,
): metadataRepo.MetadataInsert {
  return {
    channelId,
    overview: generated.overview,
    associatedVideoTypes: generated.associatedVideoTypes,
    category: generated.category,
    language: generated.language,
  };
}

function saveMetadataInBackground(
  channelId: string,
  channelName: string,
  videoTitles: ReadonlyArray<string>,
): void {
  generateChannelMetadata(channelName, videoTitles)
    .then((generated) => metadataRepo.create(toMetadataInsert(channelId, generated)))
    .catch((err) => {
      console.error(`[metadata] Failed for channel ${channelId}:`, err);
    });
}

export async function getChannelVideos(
  channelInput: string | null,
  filter: VideosFilter = {},
): Promise<ChannelVideosResponse> {
  const existing = await resolveChannel(channelInput);
  if (existing) {
    const [allVideos, metadata, transcribedIds] = await Promise.all([
      videoRepo.findByChannelId(existing.id),
      metadataRepo.findLatest(existing.id),
      filter.transcribedOnly
        ? transcriptRepo.findTranscribedVideoIds(existing.id)
        : Promise.resolve(new Set<string>()),
    ]);
    const videos = filter.transcribedOnly
      ? allVideos.filter((v) => transcribedIds.has(v.id))
      : allVideos;
    return toApiResponse(existing, videos, metadata, transcribedIds);
  }

  const [ytData, images] = await Promise.all([
    fetchChannelVideos(channelInput!),
    fetchChannelImages(channelInput!),
  ]);

  const channel = await channelRepo.upsert({
    youtubeId: ytData.channelId,
    username: ytData.handle,
    name: ytData.channelName,
    videoCount: ytData.totalVideos,
    avatarUrl: images.avatarUrl,
    bannerUrl: images.bannerUrl,
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

  const recentTitles = ytData.videos.map((v) => v.title);
  saveMetadataInBackground(channel.id, ytData.channelName, recentTitles);

  return toApiResponse(channel, videos, null);
}

export async function getChannelMetadata(
  channelInput: string | null,
  version?: number,
): Promise<MetadataResponse> {
  const channel = await requireChannel(channelInput);

  const base = {
    channelName: channel.name,
    avatarUrl: channel.avatar_url,
    bannerUrl: channel.banner_url,
  };

  if (version !== undefined) {
    const metadata = await metadataRepo.findByVersion(channel.id, version);
    return { ...base, metadata };
  }

  const metadata = await metadataRepo.findLatest(channel.id);
  return {
    ...base,
    metadata,
    message: metadata ? undefined : "No metadata available yet.",
  };
}

export async function getChannelMetadataVersions(
  channelInput: string | null,
): Promise<MetadataVersionsResponse> {
  const channel = await requireChannel(channelInput);
  const versions = await metadataRepo.findAll(channel.id);
  return { versions };
}

export async function generateMetadata(
  channelInput: string | null,
): Promise<metadataRepo.MetadataRow> {
  const channel = await requireChannel(channelInput);
  const titles = await videoRepo.findRecentTitles(channel.id);

  if (titles.length === 0) {
    throw new NotFoundError("No videos found. Sync the channel first.");
  }

  const generated = await generateChannelMetadata(channel.name, titles);
  return metadataRepo.create(toMetadataInsert(channel.id, generated));
}
