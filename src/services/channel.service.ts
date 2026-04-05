import { NotFoundError } from "../lib/errors";
import { createLogger } from "../lib/logger";
import * as channelRepo from "../repositories/channel.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import * as transcriptRepo from "../repositories/transcript.repo";
import { generateChannelMetadata, type GeneratedMetadata } from "../ai/generate-metadata";
import { fetchChannelImages } from "../yt/fetch-channel-images";
import { fetchChannelVideos } from "../yt/fetch-videos";
import { requireChannel, resolveChannel, toApiResponse } from "./channel.helpers";
import type { ChannelVideosResponse } from "../yt/types";

const log = createLogger("channel");

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
  readonly page?: number;
  readonly limit?: number;
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
  const done = log.time(`metadata generate [${channelName}]`);
  generateChannelMetadata(channelName, videoTitles)
    .then((generated) => metadataRepo.create(toMetadataInsert(channelId, generated)))
    .then(() => done())
    .catch((err) => {
      done();
      log.error(`metadata generate failed`, { channel: channelId, err: String(err) });
    });
}

interface SyncResult {
  readonly channel: channelRepo.ChannelRow;
  readonly videos: ReadonlyArray<videoRepo.VideoRow>;
}

async function syncChannel(channelInput: string): Promise<SyncResult> {
  const [ytData, images] = await Promise.all([
    fetchChannelVideos(channelInput),
    fetchChannelImages(channelInput),
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
      uploadedAt: v.uploadedAt,
    })),
  );

  saveMetadataInBackground(channel.id, ytData.channelName, ytData.videos.map((v) => v.title));

  return { channel, videos };
}

export async function getChannelVideos(
  channelInput: string | null,
  filter: VideosFilter = {},
): Promise<ChannelVideosResponse> {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 10;
  const offset = (page - 1) * limit;
  const done = log.time(`getChannelVideos [${channelInput}] page=${page}`);

  const existing = await resolveChannel(channelInput);
  if (existing) {
    const [videos, metadata, total, transcribedIds] = await Promise.all([
      videoRepo.findByChannelIdPaginated(existing.id, limit, offset),
      metadataRepo.findLatest(existing.id),
      videoRepo.countByChannelId(existing.id),
      transcriptRepo.findTranscribedVideoIds(existing.id),
    ]);
    done();
    return toApiResponse(existing, videos, metadata, transcribedIds, { page, limit, total });
  }

  const { channel, videos: allVideos } = await syncChannel(channelInput!);
  const paginatedVideos = allVideos.slice(offset, offset + limit);

  done();
  return toApiResponse(channel, paginatedVideos, null, new Set(), { page, limit, total: allVideos.length });
}

export async function getChannelMetadata(
  channelInput: string | null,
  version?: number,
): Promise<MetadataResponse> {
  let channel = await resolveChannel(channelInput);
  if (!channel) {
    log.info(`channel not in DB, auto-syncing`, { input: channelInput });
    const result = await syncChannel(channelInput!);
    channel = result.channel;
  }

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

export async function listChannels(
  q: string | null,
  category: string | null,
  page: number | undefined,
  limit: number | undefined,
): Promise<channelRepo.ChannelListResult> {
  return channelRepo.findAllPaginated({
    q: q ?? undefined,
    category: category ?? undefined,
    page,
    limit,
  });
}

export async function generateMetadata(
  channelInput: string | null,
  force = false,
): Promise<metadataRepo.MetadataRow> {
  const channel = await requireChannel(channelInput);

  if (!force) {
    const existing = await metadataRepo.findLatest(channel.id);
    if (existing) {
      log.info(`metadata cache hit`, { channel: channel.name });
      return existing;
    }
  }

  const done = log.time(`generateMetadata [${channel.name}]`);
  const titles = await videoRepo.findRecentTitles(channel.id);

  if (titles.length === 0) {
    throw new NotFoundError("No videos found. Sync the channel first.");
  }

  const generated = await generateChannelMetadata(channel.name, titles);
  const result = await metadataRepo.create(toMetadataInsert(channel.id, generated));
  done();
  return result;
}
