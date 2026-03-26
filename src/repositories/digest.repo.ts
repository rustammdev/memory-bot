import { db } from "../db/connection";

export type DigestStatus = "pending" | "generating" | "completed" | "failed";

export interface DigestHighlight {
  readonly videoId: string;
  readonly title: string;
  readonly reason: string;
  readonly viewVelocity: number;
}

export interface DigestTopicCluster {
  readonly topic: string;
  readonly videoIds: ReadonlyArray<string>;
  readonly description: string;
}

export interface DigestRow {
  readonly id: string;
  readonly channel_id: string;
  readonly version: number;
  readonly status: DigestStatus;
  readonly period_start: Date;
  readonly period_end: Date;
  readonly new_video_count: number;
  readonly total_views: number;
  readonly summary: string | null;
  readonly highlights: ReadonlyArray<DigestHighlight> | null;
  readonly topic_clusters: ReadonlyArray<DigestTopicCluster> | null;
  readonly trend_analysis: string | null;
  readonly persona_style: string;
  readonly generated_at: Date | null;
  readonly error_message: string | null;
  readonly created_at: Date;
}

export interface DigestInsert {
  readonly channelId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly newVideoCount: number;
  readonly totalViews: number;
  readonly personaStyle: string;
}

export interface DigestUpdate {
  readonly status: DigestStatus;
  readonly summary?: string;
  readonly highlights?: ReadonlyArray<DigestHighlight>;
  readonly topicClusters?: ReadonlyArray<DigestTopicCluster>;
  readonly trendAnalysis?: string;
  readonly errorMessage?: string;
}

export async function findLatest(
  channelId: string,
): Promise<DigestRow | null> {
  const rows = await db`
    SELECT * FROM digests
    WHERE channel_id = ${channelId} AND status = 'completed'
    ORDER BY version DESC
    LIMIT 1
  `;
  return (rows[0] as DigestRow) ?? null;
}

export async function findByVersion(
  channelId: string,
  version: number,
): Promise<DigestRow | null> {
  const rows = await db`
    SELECT * FROM digests
    WHERE channel_id = ${channelId} AND version = ${version}
  `;
  return (rows[0] as DigestRow) ?? null;
}

export async function findAll(
  channelId: string,
  limit = 10,
): Promise<ReadonlyArray<DigestRow>> {
  return db`
    SELECT * FROM digests
    WHERE channel_id = ${channelId}
    ORDER BY version DESC
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<DigestRow>>;
}

export async function findPrevious(
  channelId: string,
  beforeVersion: number,
): Promise<DigestRow | null> {
  const rows = await db`
    SELECT * FROM digests
    WHERE channel_id = ${channelId}
      AND version < ${beforeVersion}
      AND status = 'completed'
    ORDER BY version DESC
    LIMIT 1
  `;
  return (rows[0] as DigestRow) ?? null;
}

export async function create(data: DigestInsert): Promise<DigestRow> {
  const rows = await db.begin(async (tx) => {
    const versionRows = await tx`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM digests
      WHERE channel_id = ${data.channelId}
    `;
    const nextVersion = (versionRows[0] as { next_version: number }).next_version;

    return tx`
      INSERT INTO digests (
        channel_id, version, status,
        period_start, period_end,
        new_video_count, total_views, persona_style
      )
      VALUES (
        ${data.channelId}, ${nextVersion}, 'pending',
        ${data.periodStart}, ${data.periodEnd},
        ${data.newVideoCount}, ${data.totalViews}, ${data.personaStyle}
      )
      RETURNING *
    `;
  });
  return rows[0] as DigestRow;
}

export async function updateById(
  id: string,
  data: DigestUpdate,
): Promise<DigestRow> {
  const rows = await db`
    UPDATE digests SET
      status         = ${data.status},
      summary        = COALESCE(${data.summary ?? null}, summary),
      highlights     = COALESCE(${data.highlights ? JSON.stringify(data.highlights) : null}::jsonb, highlights),
      topic_clusters = COALESCE(${data.topicClusters ? JSON.stringify(data.topicClusters) : null}::jsonb, topic_clusters),
      trend_analysis = COALESCE(${data.trendAnalysis ?? null}, trend_analysis),
      error_message  = ${data.errorMessage ?? null},
      generated_at   = CASE WHEN ${data.status}::text = 'completed' THEN NOW() ELSE generated_at END
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] as DigestRow;
}
