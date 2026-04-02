CREATE TABLE knowledge_builds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id        UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending',
  total_videos      INTEGER NOT NULL DEFAULT 0,
  processed_videos  INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_builds_channel ON knowledge_builds (channel_id, started_at DESC);

CREATE TABLE knowledge_processed_videos (
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  video_id   UUID NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  built_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (channel_id, video_id)
);
