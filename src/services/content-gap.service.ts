import { createLogger } from "../lib/logger";
import { ValidationError } from "../lib/errors";
import { requireChannel } from "./channel.helpers";
import * as gapRepo from "../repositories/content-gap.repo";
import * as metadataRepo from "../repositories/metadata.repo";
import * as videoRepo from "../repositories/video.repo";
import { fetchChannelEmbeddings, clusterEmbeddings, fetchChunkContents } from "../vector/cluster";
import { extractTopicsFromClusters, type ClusterSummary } from "../ai/extract-topics";
import { analyzeContentGaps } from "../ai/analyze-gaps";
import { getNicheTopics, getNicheContext } from "../lib/niche-topics";
import type { ChannelCategory } from "../lib/enums";

const log = createLogger("content-gap");

const MIN_CHUNKS = 5;
const CACHE_DAYS = 7;

export interface GapAnalysisResponse {
  readonly channelName: string;
  readonly handle: string;
  readonly category: string;
  readonly analyzedAt: string;
  readonly totalVideosAnalyzed: number;
  readonly totalChunksAnalyzed: number;
  readonly topicsCovered: ReadonlyArray<gapRepo.CoveredTopic>;
  readonly gaps: ReadonlyArray<gapRepo.ContentGap>;
  readonly summary: string;
}

function toResponse(
  channelName: string,
  handle: string,
  category: string,
  row: gapRepo.GapAnalysisRow,
): GapAnalysisResponse {
  return {
    channelName,
    handle,
    category,
    analyzedAt: row.created_at.toISOString(),
    totalVideosAnalyzed: row.total_videos_analyzed,
    totalChunksAnalyzed: row.total_chunks_analyzed,
    topicsCovered: row.topics_covered,
    gaps: row.gaps,
    summary: row.summary,
  };
}

export async function analyzeChannelGaps(
  channelInput: string | null,
  force = false,
): Promise<GapAnalysisResponse> {
  const done = log.time(`analyzeGaps [${channelInput}]`);
  const channel = await requireChannel(channelInput);
  const metadata = await metadataRepo.findLatest(channel.id);
  const category = (metadata?.category ?? "other") as ChannelCategory;

  if (!force) {
    const cached = await gapRepo.findLatest(channel.id);
    if (cached) {
      const cacheAge = Date.now() - cached.created_at.getTime();
      if (cacheAge < CACHE_DAYS * 86_400_000) {
        done();
        return toResponse(channel.name, channel.username, category, cached);
      }
    }
  }

  const embeddings = await fetchChannelEmbeddings(channel.id);
  if (embeddings.length < MIN_CHUNKS) {
    throw new ValidationError(
      `Not enough transcripts to analyze. Need at least ${MIN_CHUNKS} vectorized chunks, currently have ${embeddings.length}. Fetch and vectorize more transcripts first.`,
    );
  }

  const clusters = clusterEmbeddings(embeddings);
  log.info("clustering complete", { chunks: embeddings.length, clusters: clusters.length });

  const sampleIds = clusters.flatMap((c) =>
    c.records.slice(0, 3).map((r) => r.id),
  );
  const sampleContents = await fetchChunkContents(sampleIds);
  const contentMap = new Map(sampleContents.map((s) => [s.id, s.content]));

  const clusterSummaries: ClusterSummary[] = clusters.map((c) => {
    const titles = [...new Set(c.records.map((r) => r.videoTitle))];
    const samples = c.records
      .slice(0, 3)
      .map((r) => (contentMap.get(r.id) ?? "").slice(0, 200));
    return {
      clusterId: c.clusterId,
      videoTitles: titles.slice(0, 5),
      sampleContent: samples.join(" | "),
      chunkCount: c.records.length,
    };
  });

  const [extractedTopics, allTitles, videoCount] = await Promise.all([
    extractTopicsFromClusters(channel.name, category, clusterSummaries),
    videoRepo.findRecentTitles(channel.id, 20),
    videoRepo.countByChannelId(channel.id),
  ]);
  log.info("topics extracted", { topics: extractedTopics.length });

  const gapResult = await analyzeContentGaps({
    channelName: channel.name,
    category,
    channelOverview: metadata?.overview ?? `${channel.name} YouTube channel`,
    existingTopics: extractedTopics,
    nicheTopics: getNicheTopics(category),
    nicheContext: getNicheContext(category),
    videoTitles: allTitles,
    totalVideos: videoCount,
  });
  log.info("gaps analyzed", { gaps: gapResult.gaps.length });

  const uniqueVideoIds = new Set(embeddings.map((e) => e.videoId));

  const clusterMap = new Map(clusters.map((c) => [c.clusterId, c]));

  const topicsCovered: ReadonlyArray<gapRepo.CoveredTopic> = extractedTopics.map((t) => {
    const cluster = clusterMap.get(t.clusterId);
    const titles = cluster
      ? [...new Set(cluster.records.map((r) => r.videoTitle))].slice(0, 5)
      : [];
    return {
      id: t.clusterId,
      label: t.label,
      description: t.description,
      videoCount: titles.length,
      representativeVideoTitles: titles,
    };
  });

  const sortedGaps = [...gapResult.gaps].sort((a, b) => b.priority - a.priority);

  const saved = await gapRepo.create({
    channelId: channel.id,
    totalVideosAnalyzed: uniqueVideoIds.size,
    totalChunksAnalyzed: embeddings.length,
    topicsCovered,
    gaps: sortedGaps,
    summary: gapResult.summary,
  });

  done();
  return toResponse(channel.name, channel.username, category, saved);
}

export async function getLatestAnalysis(
  channelInput: string | null,
): Promise<GapAnalysisResponse | null> {
  const channel = await requireChannel(channelInput);
  const metadata = await metadataRepo.findLatest(channel.id);
  const row = await gapRepo.findLatest(channel.id);
  if (!row) return null;
  return toResponse(
    channel.name,
    channel.username,
    metadata?.category ?? "other",
    row,
  );
}

export async function getAnalysisVersions(
  channelInput: string | null,
): Promise<{ readonly channelName: string; readonly versions: ReadonlyArray<gapRepo.GapAnalysisRow> }> {
  const channel = await requireChannel(channelInput);
  const versions = await gapRepo.findAll(channel.id);
  return { channelName: channel.name, versions };
}
