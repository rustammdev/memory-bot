CREATE TYPE digest_status AS ENUM ('pending', 'generating', 'completed', 'failed');

CREATE TABLE digests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  status          digest_status NOT NULL DEFAULT 'pending',

  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,

  new_video_count INTEGER NOT NULL DEFAULT 0,
  total_views     BIGINT NOT NULL DEFAULT 0,

  summary         TEXT,
  highlights      JSONB,
  topic_clusters  JSONB,
  trend_analysis  TEXT,
  persona_style   TEXT NOT NULL DEFAULT 'other',

  generated_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (channel_id, version)
);

CREATE INDEX idx_digests_channel_latest ON digests (channel_id, version DESC);
CREATE INDEX idx_digests_channel_status ON digests (channel_id, status);
