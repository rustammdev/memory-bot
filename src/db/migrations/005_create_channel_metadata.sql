CREATE TABLE channel_metadata (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  version               INTEGER NOT NULL,
  overview              TEXT,
  associated_video_types TEXT,
  category              channel_category NOT NULL DEFAULT 'other',
  language              channel_language NOT NULL DEFAULT 'en',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (channel_id, version)
);

CREATE INDEX idx_metadata_channel_latest ON channel_metadata (channel_id, version DESC);
