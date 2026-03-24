import { ValidationError } from "../lib/errors";
import * as channelRepo from "../repositories/channel.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import * as transcriptRepo from "../repositories/transcript.repo";
import { generateChannelMetadata } from "../ai/generate-metadata";
import { fetchChannelImages } from "../yt/fetch-channel-images";
import { fetchChannelVideos } from "../yt/fetch-videos";
import { requireChannel, resolveChannel, toApiResponse } from "./channel.helpers";
import type { ChannelVideosResponse } from "../yt/types";

interface MetadataResponse {
  readonly metadata: metadataRepo.MetadataRow | null;
  readonly message?: string;
}

interface MetadataVersionsResponse {
  readonly versions: ReadonlyArray<metadataRepo.MetadataRow>;
}

interface VideosFilter {
  readonly transcribedOnly?: boolean;
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

  return toApiResponse(channel, videos, null);
}

export async function getChannelMetadata(
  channelInput: string | null,
  version?: number,
): Promise<MetadataResponse> {
  const channel = await requireChannel(channelInput);

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
  const channel = await requireChannel(channelInput);
  const versions = await metadataRepo.findAll(channel.id);
  return { versions };
}

export async function generateMetadata(
  channelInput: string | null,
): Promise<metadataRepo.MetadataRow> {
  const channel = await requireChannel(channelInput);

  const summaries = await transcriptRepo.findSummariesByChannelId(channel.id);
  if (summaries.length === 0) {
    throw new ValidationError(
      "No video summaries found. Fetch transcripts first.",
    );
  }

  const generated = await generateChannelMetadata(channel.name, summaries);

  return metadataRepo.create({
    channelId: channel.id,
    overview: generated.overview,
    associatedVideoTypes: generated.associatedVideoTypes,
    category: generated.category,
    language: generated.language,
  });
}
