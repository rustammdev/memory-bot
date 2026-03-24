CREATE TABLE channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id    TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  followers     INTEGER NOT NULL DEFAULT 0,
  video_count   INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_channels_username ON channels (username);
CREATE INDEX idx_channels_name_search ON channels USING gin (to_tsvector('english', name));
