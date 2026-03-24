CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunk_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  video_id      UUID NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  transcript_id UUID NOT NULL REFERENCES transcripts (id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  embedding     vector(1536) NOT NULL,
  importance    REAL NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (transcript_id, chunk_index)
);

CREATE INDEX idx_chunks_channel_embedding ON chunk_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_chunks_channel_id ON chunk_embeddings (channel_id);

ALTER TABLE transcripts ADD COLUMN vectorized BOOLEAN NOT NULL DEFAULT FALSE;
