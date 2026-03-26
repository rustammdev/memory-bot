CREATE TABLE content_gap_analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  version               INTEGER NOT NULL,
  total_videos_analyzed INTEGER NOT NULL DEFAULT 0,
  total_chunks_analyzed INTEGER NOT NULL DEFAULT 0,
  topics_covered        JSONB NOT NULL DEFAULT '[]',
  gaps                  JSONB NOT NULL DEFAULT '[]',
  summary               TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (channel_id, version)
);

CREATE INDEX idx_gap_analyses_channel_latest
  ON content_gap_analyses (channel_id, version DESC);
