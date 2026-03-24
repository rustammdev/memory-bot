CREATE TABLE transcripts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_transcripts_video_language ON transcripts (video_id, language);
