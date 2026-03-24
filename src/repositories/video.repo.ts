import { db } from "../db/connection";

export interface VideoRow {
  readonly id: string;
  readonly channel_id: string;
  readonly youtube_video_id: string;
  readonly title: string;
  readonly url: string;
  readonly view_count: number;
  readonly duration_sec: number | null;
  readonly duration_formatted: string | null;
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
}

export async function findByChannelId(
  channelId: string,
): Promise<ReadonlyArray<VideoRow>> {
  return db`
    SELECT * FROM videos
    WHERE channel_id = ${channelId}
    ORDER BY synced_at DESC
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
      const rows = await tx`
        INSERT INTO videos (
          channel_id, youtube_video_id, title, url,
          view_count, duration_sec, duration_formatted
        )
        VALUES (
          ${v.channelId},
          ${v.youtubeVideoId},
          ${v.title},
          ${v.url},
          ${v.viewCount ?? 0},
          ${v.durationSec ?? null},
          ${v.durationFormatted ?? null}
        )
        ON CONFLICT (youtube_video_id) DO UPDATE SET
          title              = EXCLUDED.title,
          view_count         = EXCLUDED.view_count,
          duration_sec       = EXCLUDED.duration_sec,
          duration_formatted = EXCLUDED.duration_formatted,
          synced_at          = NOW()
        RETURNING *
      `;
      results.push(rows[0] as VideoRow);
    }
  });
  return results;
}
