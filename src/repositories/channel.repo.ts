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

export async function findByUsernames(
  usernames: ReadonlyArray<string>,
): Promise<ReadonlyArray<ChannelRow>> {
  if (usernames.length === 0) return [];
  const names = Array.from(usernames);
  return db`
    SELECT * FROM channels WHERE username = ANY(${names})
    ORDER BY name
  ` as Promise<ReadonlyArray<ChannelRow>>;
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

export interface ChannelListItem extends ChannelRow {
  readonly category: string | null;
  readonly language: string | null;
  readonly overview: string | null;
}

export interface ChannelListOptions {
  readonly q?: string;
  readonly category?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface ChannelListResult {
  readonly channels: ReadonlyArray<ChannelListItem>;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export async function findAllPaginated(
  opts: ChannelListOptions = {},
): Promise<ChannelListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;
  const pattern = `%${opts.q ?? ""}%`;
  const hasSearch = (opts.q ?? "").trim().length > 0;
  const hasCategory = (opts.category ?? "").trim().length > 0;

  const rows = await db`
    SELECT
      c.*,
      cm.category,
      cm.language,
      cm.overview
    FROM channels c
    LEFT JOIN LATERAL (
      SELECT category, language, overview
      FROM channel_metadata
      WHERE channel_id = c.id
      ORDER BY version DESC
      LIMIT 1
    ) cm ON true
    WHERE
      (${!hasSearch} OR c.name ILIKE ${pattern} OR c.username ILIKE ${pattern})
      AND (${!hasCategory} OR cm.category = ${opts.category ?? null})
    ORDER BY c.name
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await db`
    SELECT COUNT(*)::int AS total
    FROM channels c
    LEFT JOIN LATERAL (
      SELECT category
      FROM channel_metadata
      WHERE channel_id = c.id
      ORDER BY version DESC
      LIMIT 1
    ) cm ON true
    WHERE
      (${!hasSearch} OR c.name ILIKE ${pattern} OR c.username ILIKE ${pattern})
      AND (${!hasCategory} OR cm.category = ${opts.category ?? null})
  `;

  return {
    channels: rows as ReadonlyArray<ChannelListItem>,
    total: (countRows[0] as { total: number }).total,
    page,
    limit,
  };
}
