import { db } from "../db/connection";

export type BuildStatus = "pending" | "running" | "completed" | "failed";

export interface KnowledgeBuildRow {
  readonly id: string;
  readonly channel_id: string;
  readonly status: BuildStatus;
  readonly total_videos: number;
  readonly processed_videos: number;
  readonly error: string | null;
  readonly started_at: Date;
  readonly completed_at: Date | null;
}

export async function createBuild(
  channelId: string,
  totalVideos: number,
): Promise<KnowledgeBuildRow> {
  const rows = await db`
    INSERT INTO knowledge_builds (channel_id, status, total_videos)
    VALUES (${channelId}, 'running', ${totalVideos})
    RETURNING *
  `;
  return rows[0] as KnowledgeBuildRow;
}

export async function updateProgress(
  buildId: string,
  processedVideos: number,
): Promise<void> {
  await db`
    UPDATE knowledge_builds
    SET processed_videos = ${processedVideos}
    WHERE id = ${buildId}
  `;
}

export async function completeBuild(buildId: string): Promise<void> {
  await db`
    UPDATE knowledge_builds
    SET status = 'completed', completed_at = NOW()
    WHERE id = ${buildId}
  `;
}

export async function failBuild(buildId: string, error: string): Promise<void> {
  await db`
    UPDATE knowledge_builds
    SET status = 'failed', error = ${error}, completed_at = NOW()
    WHERE id = ${buildId}
  `;
}

export async function findLatestBuild(
  channelId: string,
): Promise<KnowledgeBuildRow | null> {
  const rows = await db`
    SELECT * FROM knowledge_builds
    WHERE channel_id = ${channelId}
    ORDER BY started_at DESC
    LIMIT 1
  `;
  return (rows[0] as KnowledgeBuildRow) ?? null;
}

export async function markVideoProcessed(
  channelId: string,
  videoId: string,
): Promise<void> {
  await db`
    INSERT INTO knowledge_processed_videos (channel_id, video_id)
    VALUES (${channelId}, ${videoId})
    ON CONFLICT (channel_id, video_id) DO NOTHING
  `;
}

export async function findProcessedVideoIds(
  channelId: string,
): Promise<ReadonlySet<string>> {
  const rows = await db`
    SELECT video_id FROM knowledge_processed_videos
    WHERE channel_id = ${channelId}
  `;
  return new Set(rows.map((r: { video_id: string }) => r.video_id));
}

export async function clearProcessedVideos(channelId: string): Promise<void> {
  await db`
    DELETE FROM knowledge_processed_videos
    WHERE channel_id = ${channelId}
  `;
}

export async function markStaleBuildsFailed(channelId: string): Promise<void> {
  await db`
    UPDATE knowledge_builds
    SET status = 'failed', error = 'Build timed out', completed_at = NOW()
    WHERE channel_id = ${channelId}
      AND status = 'running'
      AND started_at < NOW() - INTERVAL '30 minutes'
  `;
}
