import { db } from "../db/connection";

export interface CoveredTopic {
  readonly id: number;
  readonly label: string;
  readonly description: string;
  readonly videoCount: number;
  readonly representativeVideoTitles: ReadonlyArray<string>;
}

export interface ContentGap {
  readonly topic: string;
  readonly reason: string;
  readonly confidence: "high" | "medium" | "low";
  readonly priority: number;
  readonly category: string;
  readonly adjacentTopics: ReadonlyArray<string>;
  readonly suggestedVideoTitle: string;
  readonly suggestedAngle: string;
}

export interface GapAnalysisRow {
  readonly id: string;
  readonly channel_id: string;
  readonly version: number;
  readonly total_videos_analyzed: number;
  readonly total_chunks_analyzed: number;
  readonly topics_covered: ReadonlyArray<CoveredTopic>;
  readonly gaps: ReadonlyArray<ContentGap>;
  readonly summary: string;
  readonly created_at: Date;
}

export interface GapAnalysisInsert {
  readonly channelId: string;
  readonly totalVideosAnalyzed: number;
  readonly totalChunksAnalyzed: number;
  readonly topicsCovered: ReadonlyArray<CoveredTopic>;
  readonly gaps: ReadonlyArray<ContentGap>;
  readonly summary: string;
}

export async function findLatest(
  channelId: string,
): Promise<GapAnalysisRow | null> {
  const rows = await db`
    SELECT * FROM content_gap_analyses
    WHERE channel_id = ${channelId}
    ORDER BY version DESC
    LIMIT 1
  `;
  return (rows[0] as GapAnalysisRow) ?? null;
}

export async function findByVersion(
  channelId: string,
  version: number,
): Promise<GapAnalysisRow | null> {
  const rows = await db`
    SELECT * FROM content_gap_analyses
    WHERE channel_id = ${channelId} AND version = ${version}
  `;
  return (rows[0] as GapAnalysisRow) ?? null;
}

export async function findAll(
  channelId: string,
  limit = 10,
): Promise<ReadonlyArray<GapAnalysisRow>> {
  return db`
    SELECT * FROM content_gap_analyses
    WHERE channel_id = ${channelId}
    ORDER BY version DESC
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<GapAnalysisRow>>;
}

export async function create(
  data: GapAnalysisInsert,
): Promise<GapAnalysisRow> {
  const rows = await db.begin(async (tx) => {
    const versionRows = await tx`
      SELECT COALESCE(MAX(version), 0) + 1 AS next_version
      FROM content_gap_analyses
      WHERE channel_id = ${data.channelId}
    `;
    const nextVersion = (versionRows[0] as { next_version: number }).next_version;

    return tx`
      INSERT INTO content_gap_analyses (
        channel_id, version,
        total_videos_analyzed, total_chunks_analyzed,
        topics_covered, gaps, summary
      )
      VALUES (
        ${data.channelId}, ${nextVersion},
        ${data.totalVideosAnalyzed}, ${data.totalChunksAnalyzed},
        ${JSON.stringify(data.topicsCovered)}::jsonb,
        ${JSON.stringify(data.gaps)}::jsonb,
        ${data.summary}
      )
      RETURNING *
    `;
  });
  return rows[0] as GapAnalysisRow;
}
