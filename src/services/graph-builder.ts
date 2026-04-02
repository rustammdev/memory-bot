import { createLogger } from "../lib/logger";
import { ConflictError, ValidationError } from "../lib/errors";
import * as knowledgeRepo from "../repositories/knowledge.repo";
import * as buildRepo from "../repositories/knowledge-build.repo";
import { extractKnowledge } from "../ai/extract-knowledge";

const log = createLogger("graph-builder");

const MIN_CHUNKS = 5;
const CHUNKS_PER_BATCH = 4;
const MAX_VIDEOS_PER_BUILD = 50;
const MAX_CONCURRENT_VIDEOS = 3;

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

  const allChunks = await knowledgeRepo.findChunksWithVideos(channelId);
  if (allChunks.length < MIN_CHUNKS) {
    throw new ValidationError(
      `Not enough transcripts. Need at least ${MIN_CHUNKS} chunks, have ${allChunks.length}. Fetch more transcripts first.`,
    );
  }

  const processedIds = await buildRepo.findProcessedVideoIds(channelId);
  const videoChunks = Map.groupBy(allChunks, (c) => c.video_id);
  const videoIds = [...videoChunks.keys()]
    .filter((id) => !processedIds.has(id))
    .slice(0, MAX_VIDEOS_PER_BUILD);

  if (videoIds.length === 0) {
    const latest = await buildRepo.findLatestBuild(channelId);
    if (latest) return toBuildStatus(latest);
    throw new ValidationError("No new videos to process. Graph is up to date.");
  }

  const buildRow = await buildRepo.createBuild(channelId, videoIds.length);

  const status: BuildStatus = {
    buildId: buildRow.id,
    channelId,
    status: "running",
    totalVideos: videoIds.length,
    processedVideos: 0,
    startedAt: buildRow.started_at.toISOString(),
    completedAt: null,
    error: null,
  };
  activeBuilds.set(channelId, status);

  runBuild(buildRow.id, channelId, category, videoIds, videoChunks).catch((err) => {
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
  videoIds: ReadonlyArray<string>,
  videoChunks: Map<string, ReadonlyArray<knowledgeRepo.ChunkWithVideo>>,
): Promise<void> {
  const done = log.time(`build [${channelId}] ${videoIds.length} videos`);
  let processed = 0;

  try {
    await processWithConcurrency(videoIds, MAX_CONCURRENT_VIDEOS, async (videoId) => {
      const chunks = videoChunks.get(videoId) ?? [];
      await processVideo(channelId, chunks, category);
      await buildRepo.markVideoProcessed(channelId, videoId);

      processed += 1;
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

export async function processVideo(
  channelId: string,
  chunks: ReadonlyArray<knowledgeRepo.ChunkWithVideo>,
  category: string,
): Promise<void> {
  const videoTitle = chunks[0]?.video_title ?? "Unknown";
  const nodeMap = new Map<string, knowledgeRepo.KnowledgeNodeRow>();

  for (let i = 0; i < chunks.length; i += CHUNKS_PER_BATCH) {
    const batch = chunks.slice(i, i + CHUNKS_PER_BATCH);

    try {
      const result = await extractKnowledge(
        videoTitle,
        category,
        batch.map((c) => ({ content: c.content, chunkId: c.id })),
      );

      const upsertedNodes = await knowledgeRepo.upsertNodes(
        channelId,
        result.entities.map((e) => ({
          label: e.label,
          type: e.type,
          description: e.description,
        })),
      );

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

      await linkEntityMentions(result.entities, batch, nodeMap);
    } catch (err) {
      log.warn("extraction failed for batch, skipping", {
        videoTitle,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function linkEntityMentions(
  entities: ReadonlyArray<{ label: string }>,
  batch: ReadonlyArray<knowledgeRepo.ChunkWithVideo>,
  nodeMap: Map<string, knowledgeRepo.KnowledgeNodeRow>,
): Promise<void> {
  const refs: knowledgeRepo.VideoRefInsert[] = [];

  for (const entity of entities) {
    const node = nodeMap.get(knowledgeRepo.normalizeLabel(entity.label));
    if (!node) continue;

    const lowerLabel = entity.label.toLowerCase();
    for (const chunk of batch) {
      if (chunk.content.toLowerCase().includes(lowerLabel)) {
        refs.push({
          nodeId: node.id,
          videoId: chunk.video_id,
          chunkId: chunk.id,
          context: extractSnippet(chunk.content, entity.label),
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

async function processWithConcurrency<T>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}
