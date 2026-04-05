import { db } from "../db/connection";
import type { VideoThumbnails } from "../yt/types";

export type { VideoThumbnails };

export function buildThumbnails(youtubeVideoId: string): VideoThumbnails {
  const base = `https://img.youtube.com/vi/${youtubeVideoId}`;
  return {
    default: `${base}/default.jpg`,
    medium: `${base}/mqdefault.jpg`,
    high: `${base}/hqdefault.jpg`,
    maxres: `${base}/maxresdefault.jpg`,
  };
}

export interface VideoRow {
  readonly id: string;
  readonly channel_id: string;
  readonly youtube_video_id: string;
  readonly title: string;
  readonly url: string;
  readonly view_count: number;
  readonly duration_sec: number | null;
  readonly duration_formatted: string | null;
  readonly thumbnail_default: string | null;
  readonly thumbnail_medium: string | null;
  readonly thumbnail_high: string | null;
  readonly thumbnail_maxres: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly uploaded_at: Date | null;
  readonly synced_at: Date;
  readonly created_at: Date;
}

export interface VideoInsert {
  readonly channelId: string;
  readonly youtubeVideoId: string;
  readonly title: string;
  readonly url: string;
  readonly viewCount?: number;
  readonly durationSec?: number | null;
  readonly durationFormatted?: string | null;
  readonly thumbnails?: VideoThumbnails;
  readonly uploadedAt?: Date | null;
}


export async function findByChannelId(
  channelId: string,
): Promise<ReadonlyArray<VideoRow>> {
  return db`
    SELECT * FROM videos
    WHERE channel_id = ${channelId}
    ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
  ` as Promise<ReadonlyArray<VideoRow>>;
}

export async function findByChannelIdPaginated(
  channelId: string,
  limit: number,
  offset: number,
): Promise<ReadonlyArray<VideoRow>> {
  return db`
    SELECT * FROM videos
    WHERE channel_id = ${channelId}
    ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  ` as Promise<ReadonlyArray<VideoRow>>;
}

export async function findByYoutubeVideoId(
  youtubeVideoId: string,
): Promise<VideoRow | null> {
  const rows = await db`
    SELECT * FROM videos WHERE youtube_video_id = ${youtubeVideoId}
  `;
  return (rows[0] as VideoRow) ?? null;
}

export async function bulkUpsert(
  videos: ReadonlyArray<VideoInsert>,
): Promise<ReadonlyArray<VideoRow>> {
  if (videos.length === 0) return [];

  const results: VideoRow[] = [];
  await db.begin(async (tx) => {
    for (const v of videos) {
      const thumbs = v.thumbnails ?? buildThumbnails(v.youtubeVideoId);
      const rows = await tx`
        INSERT INTO videos (
          channel_id, youtube_video_id, title, url,
          view_count, duration_sec, duration_formatted,
          thumbnail_default, thumbnail_medium, thumbnail_high, thumbnail_maxres,
          uploaded_at
        )
        VALUES (
          ${v.channelId},
          ${v.youtubeVideoId},
          ${v.title},
          ${v.url},
          ${v.viewCount ?? 0},
          ${v.durationSec ?? null},
          ${v.durationFormatted ?? null},
          ${thumbs.default},
          ${thumbs.medium},
          ${thumbs.high},
          ${thumbs.maxres},
          ${v.uploadedAt ?? null}
        )
        ON CONFLICT (youtube_video_id) DO UPDATE SET
          title              = EXCLUDED.title,
          view_count         = EXCLUDED.view_count,
          duration_sec       = EXCLUDED.duration_sec,
          duration_formatted = EXCLUDED.duration_formatted,
          thumbnail_default  = COALESCE(videos.thumbnail_default, EXCLUDED.thumbnail_default),
          thumbnail_medium   = COALESCE(videos.thumbnail_medium, EXCLUDED.thumbnail_medium),
          thumbnail_high     = COALESCE(videos.thumbnail_high, EXCLUDED.thumbnail_high),
          thumbnail_maxres   = COALESCE(videos.thumbnail_maxres, EXCLUDED.thumbnail_maxres),
          uploaded_at        = COALESCE(EXCLUDED.uploaded_at, videos.uploaded_at),
          synced_at          = NOW()
        RETURNING *
      `;
      results.push(rows[0] as VideoRow);
    }
  });
  return results;
}

export async function searchByChannelId(
  channelId: string,
  query?: string,
  limit = 20,
): Promise<ReadonlyArray<VideoRow>> {
  if (query) {
    const pattern = `%${query}%`;
    return db`
      SELECT * FROM videos
      WHERE channel_id = ${channelId} AND title ILIKE ${pattern}
      ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
      LIMIT ${limit}
    ` as Promise<ReadonlyArray<VideoRow>>;
  }
  return db`
    SELECT * FROM videos
    WHERE channel_id = ${channelId}
    ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<VideoRow>>;
}

export async function findRecentTitles(
  channelId: string,
  limit = 15,
): Promise<ReadonlyArray<string>> {
  const rows = await db`
    SELECT title FROM videos
    WHERE channel_id = ${channelId}
    ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r: { title: string }) => r.title);
}

export async function countByChannelId(channelId: string): Promise<number> {
  const rows = await db`
    SELECT COUNT(*)::int AS cnt FROM videos WHERE channel_id = ${channelId}
  `;
  return (rows[0] as { cnt: number }).cnt;
}

export async function getMaxViewCount(channelId: string): Promise<number> {
  const rows = await db`
    SELECT COALESCE(MAX(view_count), 0) AS max_views
    FROM videos WHERE channel_id = ${channelId}
  `;
  return (rows[0] as { max_views: number }).max_views;
}

export interface VideoWithVelocity extends VideoRow {
  readonly view_velocity: number;
}

export async function findNewSince(
  channelId: string,
  since: Date,
  limit = 50,
): Promise<ReadonlyArray<VideoRow>> {
  return db`
    SELECT * FROM videos
    WHERE channel_id = ${channelId} AND synced_at > ${since}
    ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<VideoRow>>;
}

export async function findUntranscribedByChannel(
  channelId: string,
  limit: number,
  language = "en",
): Promise<ReadonlyArray<VideoRow>> {
  return db`
    SELECT v.* FROM videos v
    LEFT JOIN transcripts t ON t.video_id = v.id AND t.language = ${language}
    WHERE v.channel_id = ${channelId} AND t.id IS NULL
    ORDER BY v.uploaded_at DESC NULLS LAST
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<VideoRow>>;
}

export async function findLatestByChannel(
  channelId: string,
  limit: number,
): Promise<ReadonlyArray<VideoRow>> {
  return db`
    SELECT * FROM videos
    WHERE channel_id = ${channelId}
    ORDER BY uploaded_at DESC NULLS LAST
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<VideoRow>>;
}

export async function findByYoutubeVideoIds(
  channelId: string,
  youtubeVideoIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<VideoRow>> {
  if (youtubeVideoIds.length === 0) return [];
  return db`
    SELECT * FROM videos
    WHERE channel_id = ${channelId}
      AND youtube_video_id = ANY(${db.array(youtubeVideoIds as string[])})
    ORDER BY uploaded_at DESC NULLS LAST
  ` as Promise<ReadonlyArray<VideoRow>>;
}

export async function updateTags(
  videoId: string,
  tags: ReadonlyArray<string>,
): Promise<void> {
  await db`
    UPDATE videos SET tags = ${db.array(tags as string[])} WHERE id = ${videoId}
  `;
}

export async function findWithViewVelocity(
  channelId: string,
  since: Date,
  limit = 30,
): Promise<ReadonlyArray<VideoWithVelocity>> {
  return db`
    SELECT *,
      view_count / GREATEST(EXTRACT(EPOCH FROM (NOW() - synced_at)) / 86400.0, 1) AS view_velocity
    FROM videos
    WHERE channel_id = ${channelId} AND synced_at > ${since}
    ORDER BY view_velocity DESC
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<VideoWithVelocity>>;
}

export async function findNewSinceWithSummaries(
  channelId: string,
  since: Date,
  limit = 50,
): Promise<ReadonlyArray<VideoRow & { readonly summary: string | null }>> {
  return db`
    SELECT v.*, t.summary
    FROM videos v
    LEFT JOIN transcripts t ON t.video_id = v.id AND t.language = 'en'
    WHERE v.channel_id = ${channelId} AND v.synced_at > ${since}
    ORDER BY v.synced_at DESC
    LIMIT ${limit}
  ` as Promise<ReadonlyArray<VideoRow & { readonly summary: string | null }>>;
}
