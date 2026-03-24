import { db } from "../db/connection";

export interface ChannelRow {
  readonly id: string;
  readonly youtube_id: string;
  readonly username: string;
  readonly name: string;
  readonly followers: number;
  readonly video_count: number;
  readonly last_synced_at: Date;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface ChannelInsert {
  readonly youtubeId: string;
  readonly username: string;
  readonly name: string;
  readonly followers?: number;
  readonly videoCount?: number;
}

export async function findByUsername(
  username: string,
): Promise<ChannelRow | null> {
  const handle = username.startsWith("@") ? username : `@${username}`;
  const rows = await db`
    SELECT * FROM channels WHERE username = ${handle}
  `;
  return (rows[0] as ChannelRow) ?? null;
}

export async function findByYoutubeId(
  youtubeId: string,
): Promise<ChannelRow | null> {
  const rows = await db`
    SELECT * FROM channels WHERE youtube_id = ${youtubeId}
  `;
  return (rows[0] as ChannelRow) ?? null;
}

export async function upsert(data: ChannelInsert): Promise<ChannelRow> {
  const rows = await db`
    INSERT INTO channels (youtube_id, username, name, followers, video_count)
    VALUES (
      ${data.youtubeId},
      ${data.username},
      ${data.name},
      ${data.followers ?? 0},
      ${data.videoCount ?? 0}
    )
    ON CONFLICT (youtube_id) DO UPDATE SET
      name           = EXCLUDED.name,
      followers      = EXCLUDED.followers,
      video_count    = EXCLUDED.video_count,
      last_synced_at = NOW(),
      updated_at     = NOW()
    RETURNING *
  `;
  return rows[0] as ChannelRow;
}

export async function search(
  query: string,
): Promise<ReadonlyArray<ChannelRow>> {
  const pattern = `%${query}%`;
  return db`
    SELECT * FROM channels
    WHERE username ILIKE ${pattern} OR name ILIKE ${pattern}
    ORDER BY name
  ` as Promise<ReadonlyArray<ChannelRow>>;
}
