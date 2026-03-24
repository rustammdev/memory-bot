import { db } from "../db/connection";

export interface TranscriptRow {
  readonly id: string;
  readonly video_id: string;
  readonly content: string;
  readonly language: string;
  readonly created_at: Date;
}

export interface TranscriptInsert {
  readonly videoId: string;
  readonly content: string;
  readonly language?: string;
}

export async function findByVideoId(
  videoId: string,
  language = "en",
): Promise<TranscriptRow | null> {
  const rows = await db`
    SELECT * FROM transcripts
    WHERE video_id = ${videoId} AND language = ${language}
  `;
  return (rows[0] as TranscriptRow) ?? null;
}

export async function findTranscribedVideoIds(
  channelId: string,
): Promise<ReadonlySet<string>> {
  const rows = await db`
    SELECT v.id FROM transcripts t
    JOIN videos v ON v.id = t.video_id
    WHERE v.channel_id = ${channelId}
  `;
  return new Set(rows.map((r: { id: string }) => r.id));
}

export async function upsert(data: TranscriptInsert): Promise<TranscriptRow> {
  const rows = await db`
    INSERT INTO transcripts (video_id, content, language)
    VALUES (${data.videoId}, ${data.content}, ${data.language ?? "en"})
    ON CONFLICT (video_id, language) DO UPDATE SET
      content = EXCLUDED.content
    RETURNING *
  `;
  return rows[0] as TranscriptRow;
}
