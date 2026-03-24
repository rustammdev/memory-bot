import { db } from "../db/connection";

export interface MetadataRow {
  readonly id: string;
  readonly channel_id: string;
  readonly version: number;
  readonly overview: string | null;
  readonly associated_video_types: string | null;
  readonly category: string;
  readonly language: string;
  readonly created_at: Date;
}

export interface MetadataInsert {
  readonly channelId: string;
  readonly overview?: string | null;
  readonly associatedVideoTypes?: string | null;
  readonly category?: string;
  readonly language?: string;
}

export async function findLatest(
  channelId: string,
): Promise<MetadataRow | null> {
  const rows = await db`
    SELECT * FROM channel_metadata
    WHERE channel_id = ${channelId}
    ORDER BY version DESC
    LIMIT 1
  `;
  return (rows[0] as MetadataRow) ?? null;
}

export async function findByVersion(
  channelId: string,
  version: number,
): Promise<MetadataRow | null> {
  const rows = await db`
    SELECT * FROM channel_metadata
    WHERE channel_id = ${channelId} AND version = ${version}
  `;
  return (rows[0] as MetadataRow) ?? null;
}

export async function findAll(
  channelId: string,
): Promise<ReadonlyArray<MetadataRow>> {
  return db`
    SELECT * FROM channel_metadata
    WHERE channel_id = ${channelId}
    ORDER BY version DESC
  ` as Promise<ReadonlyArray<MetadataRow>>;
}

export async function create(data: MetadataInsert): Promise<MetadataRow> {
  const rows = await db`
    INSERT INTO channel_metadata (
      channel_id, version, overview,
      associated_video_types, category, language
    )
    VALUES (
      ${data.channelId},
      COALESCE(
        (SELECT MAX(version) + 1 FROM channel_metadata WHERE channel_id = ${data.channelId}),
        1
      ),
      ${data.overview ?? null},
      ${data.associatedVideoTypes ?? null},
      ${data.category ?? "other"},
      ${data.language ?? "en"}
    )
    RETURNING *
  `;
  return rows[0] as MetadataRow;
}
