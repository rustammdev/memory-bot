CREATE TABLE videos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id         UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  youtube_video_id   TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  url                TEXT NOT NULL,
  view_count         INTEGER NOT NULL DEFAULT 0,
  duration_sec       INTEGER,
  duration_formatted TEXT,
  uploaded_at        TIMESTAMPTZ,
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_channel_id ON videos (channel_id);
CREATE INDEX idx_videos_title_search ON videos USING gin (to_tsvector('english', title));
