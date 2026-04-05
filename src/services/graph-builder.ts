import { createLogger } from "../lib/logger";
import { ConflictError, ValidationError } from "../lib/errors";
import { processWithConcurrency } from "../lib/concurrency";
import { toBatches } from "../lib/collection";
import * as knowledgeRepo from "../repositories/knowledge.repo";
import * as buildRepo from "../repositories/knowledge-build.repo";
import { extractKnowledge } from "../ai/extract-knowledge";

export type TagFilter = ReadonlyArray<string>;

const log = createLogger("graph-builder");

const MIN_VIDEOS = 3;
const DEFAULT_BUILD_LIMIT = 50;
const VIDEOS_PER_BATCH = 20;
const MAX_CONCURRENT_BATCHES = 2;

export interface BuildStatus {
  readonly buildId: string;
  readonly channelId: string;
  readonly status: buildRepo.BuildStatus;
  readonly totalVideos: number;
  readonly processedVideos: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly error: string | null;
}

const activeBuilds = new Map<string, BuildStatus>();

function toBuildStatus(row: buildRepo.KnowledgeBuildRow): BuildStatus {
  return {
    buildId: row.id,
    channelId: row.channel_id,
    status: row.status,
    totalVideos: row.total_videos,
    processedVideos: row.processed_videos,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    error: row.error,
  };
}

export async function startBuild(
  channelId: string,
  category: string,
  force: boolean,
  limit = DEFAULT_BUILD_LIMIT,
  tags?: TagFilter,
): Promise<BuildStatus> {
  const existing = activeBuilds.get(channelId);
  if (existing?.status === "running") {
    throw new ConflictError("A build is already running for this channel. Check status or wait for completion.");
  }

  await buildRepo.markStaleBuildsFailed(channelId);

  if (force) {
    await Promise.all([
      knowledgeRepo.deleteChannelGraph(channelId),
      buildRepo.clearProcessedVideos(channelId),
    ]);
  }

  const allSummaries = tags && tags.length > 0
    ? await knowledgeRepo.findVideoSummariesByTags(channelId, tags)
    : await knowledgeRepo.findVideoSummaries(channelId);
  if (allSummaries.length < MIN_VIDEOS) {
    throw new ValidationError(
      `Not enough transcripts with summaries. Need at least ${MIN_VIDEOS}, have ${allSummaries.length}. Fetch more transcripts first.`,
    );
  }

  const processedIds = await buildRepo.findProcessedVideoIds(channelId);
  const unprocessed = allSummaries
    .filter((s) => !processedIds.has(s.video_id))
    .slice(0, limit);

  if (unprocessed.length === 0) {
    const latest = await buildRepo.findLatestBuild(channelId);
    if (latest) return toBuildStatus(latest);
    throw new ValidationError("No new videos to process. Graph is up to date.");
  }

  const buildRow = await buildRepo.createBuild(channelId, unprocessed.length);

  const status: BuildStatus = {
    buildId: buildRow.id,
    channelId,
    status: "running",
    totalVideos: unprocessed.length,
    processedVideos: 0,
    startedAt: buildRow.started_at.toISOString(),
    completedAt: null,
    error: null,
  };
  activeBuilds.set(channelId, status);

  runBuild(buildRow.id, channelId, category, unprocessed).catch((err) => {
    log.error("background build crashed", { channelId, error: err instanceof Error ? err.message : String(err) });
  });

  return status;
}

export async function getBuildStatus(channelId: string): Promise<BuildStatus | null> {
  const active = activeBuilds.get(channelId);
  if (active?.status === "running") return active;

  await buildRepo.markStaleBuildsFailed(channelId);
  const row = await buildRepo.findLatestBuild(channelId);
  return row ? toBuildStatus(row) : null;
}

async function runBuild(
  buildId: string,
  channelId: string,
  category: string,
  summaries: ReadonlyArray<knowledgeRepo.VideoSummary>,
): Promise<void> {
  const done = log.time(`build [${channelId}] ${summaries.length} videos`);
  let processed = 0;

  try {
    const batches = toBatches(summaries, VIDEOS_PER_BATCH);

    await processWithConcurrency(batches, MAX_CONCURRENT_BATCHES, async (batch) => {
      await processBatch(channelId, batch, category);

      for (const s of batch) {
        await buildRepo.markVideoProcessed(channelId, s.video_id);
      }

      processed += batch.length;
      await buildRepo.updateProgress(buildId, processed);
      activeBuilds.set(channelId, {
        ...activeBuilds.get(channelId)!,
        processedVideos: processed,
      });
    });

    await knowledgeRepo.updateImportance(channelId);
    await buildRepo.completeBuild(buildId);
    activeBuilds.set(channelId, {
      ...activeBuilds.get(channelId)!,
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    log.info("build completed", { channelId, processed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await buildRepo.failBuild(buildId, message);
    activeBuilds.set(channelId, {
      ...activeBuilds.get(channelId)!,
      status: "failed",
      error: message,
    });
    log.error("build failed", { channelId, error: message });
  } finally {
    done();
  }
}

export async function processBatch(
  channelId: string,
  summaries: ReadonlyArray<knowledgeRepo.VideoSummary>,
  category: string,
): Promise<void> {
  if (summaries.length === 0) return;

  const videos = summaries.map((s) => ({ title: s.video_title, summary: s.content }));

  try {
    const result = await extractKnowledge(videos, category);

    const upsertedNodes = await knowledgeRepo.upsertNodes(
      channelId,
      result.entities.map((e) => ({
        label: e.label,
        type: e.type,
        description: e.description,
      })),
    );

    const nodeMap = new Map<string, knowledgeRepo.KnowledgeNodeRow>();
    for (const node of upsertedNodes) {
      nodeMap.set(node.normalized_label, node);
    }

    await Promise.all(
      result.relationships.map((rel) =>
        knowledgeRepo.upsertEdge({
          channelId,
          sourceLabel: rel.source,
          targetLabel: rel.target,
          relationship: rel.type,
          context: rel.context,
        }),
      ),
    );

    await linkVideoRefs(result.entities, summaries, nodeMap);
  } catch (err) {
    log.warn("batch extraction failed, skipping", {
      videos: summaries.length,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function linkVideoRefs(
  entities: ReadonlyArray<{ label: string }>,
  summaries: ReadonlyArray<knowledgeRepo.VideoSummary>,
  nodeMap: Map<string, knowledgeRepo.KnowledgeNodeRow>,
): Promise<void> {
  const refs: knowledgeRepo.VideoRefInsert[] = [];
  const lowerContents = summaries.map((s) => s.content.toLowerCase());

  for (const entity of entities) {
    const node = nodeMap.get(knowledgeRepo.normalizeLabel(entity.label));
    if (!node) continue;

    const lowerLabel = entity.label.toLowerCase();
    for (let i = 0; i < summaries.length; i++) {
      if (lowerContents[i]!.includes(lowerLabel)) {
        refs.push({
          nodeId: node.id,
          videoId: summaries[i]!.video_id,
          chunkId: null,
          context: extractSnippet(summaries[i]!.content, entity.label),
          relevance: 1.0,
        });
      }
    }
  }

  await Promise.all(refs.map((ref) => knowledgeRepo.addVideoRef(ref)));
}

function extractSnippet(content: string, term: string): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return content.slice(0, 150);
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + term.length + 60);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end)}${suffix}`;
}
