import { db } from "../db/connection";

export interface ChannelRow {
  readonly id: string;
  readonly youtube_id: string;
  readonly username: string;
  readonly name: string;
  readonly followers: number;
  readonly video_count: number;
  readonly avatar_url: string | null;
  readonly banner_url: string | null;
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
  readonly avatarUrl?: string | null;
  readonly bannerUrl?: string | null;
}

export async function findByUsername(
  username: string,
): Promise<ChannelRow | null> {
  const rows = await db`
    SELECT * FROM channels WHERE username = ${username}
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
    INSERT INTO channels (youtube_id, username, name, followers, video_count, avatar_url, banner_url)
    VALUES (
      ${data.youtubeId},
      ${data.username},
      ${data.name},
      ${data.followers ?? 0},
      ${data.videoCount ?? 0},
      ${data.avatarUrl ?? null},
      ${data.bannerUrl ?? null}
    )
    ON CONFLICT (youtube_id) DO UPDATE SET
      name           = EXCLUDED.name,
      followers      = EXCLUDED.followers,
      video_count    = EXCLUDED.video_count,
      avatar_url     = COALESCE(EXCLUDED.avatar_url, channels.avatar_url),
      banner_url     = COALESCE(EXCLUDED.banner_url, channels.banner_url),
      last_synced_at = NOW(),
      updated_at     = NOW()
    RETURNING *
  `;
  return rows[0] as ChannelRow;
}

export async function search(
  query: string,
  limit = 50,
): Promise<ReadonlyArray<ChannelRow>> {
  const pattern = `%${query}%`;
  return db`
    SELECT * FROM channels
    WHERE username ILIKE ${pattern} OR name ILIKE ${pattern}
    ORDER BY name
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<ChannelRow>>;
}
