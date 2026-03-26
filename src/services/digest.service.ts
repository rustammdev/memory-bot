import { createLogger } from "../lib/logger";
import { ValidationError } from "../lib/errors";
import { requireChannel } from "./channel.helpers";
import { PERSONA_MAP } from "../agent/channel/persona";
import * as digestRepo from "../repositories/digest.repo";
import * as videoRepo from "../repositories/video.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import { recallMemories } from "../memory/client";
import { generateDigest, type DigestVideoInput } from "../ai/generate-digest";
import type { ChannelRow } from "../repositories/channel.repo";
import type { ChannelCategory } from "../lib/enums";

const log = createLogger("digest");

interface GenerateDigestRequest {
  readonly channel: string;
  readonly userId?: string;
  readonly periodDays?: number;
  readonly force?: boolean;
}

interface DigestResponse {
  readonly channelName: string;
  readonly handle: string;
  readonly digest: {
    readonly version: number;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly summary: string;
    readonly highlights: ReadonlyArray<digestRepo.DigestHighlight>;
    readonly topicClusters: ReadonlyArray<digestRepo.DigestTopicCluster>;
    readonly trendAnalysis: string;
    readonly newVideoCount: number;
    readonly totalViews: number;
    readonly generatedAt: string | null;
  };
}

function formatDigestResponse(
  channel: ChannelRow,
  digest: digestRepo.DigestRow,
): DigestResponse {
  return {
    channelName: channel.name,
    handle: channel.username,
    digest: {
      version: digest.version,
      periodStart: digest.period_start.toISOString(),
      periodEnd: digest.period_end.toISOString(),
      summary: digest.summary ?? "",
      highlights: digest.highlights ?? [],
      topicClusters: digest.topic_clusters ?? [],
      trendAnalysis: digest.trend_analysis ?? "",
      newVideoCount: digest.new_video_count,
      totalViews: Number(digest.total_views),
      generatedAt: digest.generated_at?.toISOString() ?? null,
    },
  };
}

export async function generateChannelDigest(
  request: GenerateDigestRequest,
): Promise<DigestResponse> {
  const done = log.time(`generateDigest [${request.channel}]`);
  const channel = await requireChannel(request.channel);
  const periodDays = request.periodDays ?? 7;

  if (periodDays < 1 || periodDays > 30) {
    throw new ValidationError("periodDays must be between 1 and 30");
  }

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 86_400_000);

  const previousDigest = await digestRepo.findLatest(channel.id);

  if (!request.force && previousDigest) {
    if (previousDigest.period_end.getTime() > periodStart.getTime()) {
      done();
      return formatDigestResponse(channel, previousDigest);
    }
  }

  const [newVideosWithSummaries, trendingVideos, metadata] = await Promise.all([
    videoRepo.findNewSinceWithSummaries(channel.id, periodStart),
    videoRepo.findWithViewVelocity(channel.id, periodStart),
    metadataRepo.findLatest(channel.id),
  ]);

  const category = (metadata?.category ?? "other") as ChannelCategory;
  const persona = PERSONA_MAP[category] ?? PERSONA_MAP.other;

  const totalViews = newVideosWithSummaries.reduce((sum, v) => sum + v.view_count, 0);

  const velocityMap = new Map(
    trendingVideos.map((v) => [v.youtube_video_id, v.view_velocity]),
  );

  const videoInputs: DigestVideoInput[] = newVideosWithSummaries.map((v) => ({
    youtubeVideoId: v.youtube_video_id,
    title: v.title,
    viewCount: v.view_count,
    viewVelocity: velocityMap.get(v.youtube_video_id) ?? 0,
    summary: v.summary ?? null,
    durationFormatted: v.duration_formatted,
  }));

  const digestRow = await digestRepo.create({
    channelId: channel.id,
    periodStart,
    periodEnd,
    newVideoCount: newVideosWithSummaries.length,
    totalViews,
    personaStyle: category,
  });

  if (newVideosWithSummaries.length === 0) {
    const updated = await digestRepo.updateById(digestRow.id, {
      status: "completed",
      summary: "No new content published during this period.",
      highlights: [],
      topicClusters: [],
      trendAnalysis: previousDigest
        ? "No new videos compared to the previous digest period."
        : "This is the first digest — no prior data to compare.",
    });
    done();
    return formatDigestResponse(channel, updated);
  }

  const userInterests = request.userId
    ? (await recallMemories(
        "user interests and preferences",
        { userId: request.userId, agentId: channel.id },
        5,
      )) || null
    : null;

  const periodLabel = `${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  await digestRepo.updateById(digestRow.id, { status: "generating" });

  try {
    const generated = await generateDigest({
      channelName: channel.name,
      category,
      personaTone: persona.tone,
      personaStyle: persona.style,
      newVideos: videoInputs,
      previousDigestSummary: previousDigest?.summary ?? null,
      userInterests,
      periodLabel,
    });

    const updated = await digestRepo.updateById(digestRow.id, {
      status: "completed",
      summary: generated.summary,
      highlights: generated.highlights,
      topicClusters: generated.topicClusters,
      trendAnalysis: generated.trendAnalysis,
    });

    done();
    return formatDigestResponse(channel, updated);
  } catch (err) {
    await digestRepo.updateById(digestRow.id, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function getLatestDigest(
  channelInput: string | null,
  version?: number,
): Promise<DigestResponse | null> {
  const channel = await requireChannel(channelInput);

  const digest = version !== undefined
    ? await digestRepo.findByVersion(channel.id, version)
    : await digestRepo.findLatest(channel.id);

  if (!digest) return null;
  return formatDigestResponse(channel, digest);
}

export async function getDigestHistory(
  channelInput: string | null,
  limit = 10,
): Promise<{ readonly channelName: string; readonly digests: ReadonlyArray<digestRepo.DigestRow> }> {
  const channel = await requireChannel(channelInput);
  const digests = await digestRepo.findAll(channel.id, limit);
  return { channelName: channel.name, digests };
}
