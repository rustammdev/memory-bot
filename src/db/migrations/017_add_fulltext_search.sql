-- Full-text search support for hybrid retrieval (vector + keyword)
-- Uses a generated tsvector column for automatic index maintenance

ALTER TABLE chunk_embeddings
  ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_chunks_fulltext ON chunk_embeddings USING gin(tsv);

-- Composite index for channel-scoped keyword search
CREATE INDEX idx_chunks_channel_fulltext ON chunk_embeddings (channel_id)
  INCLUDE (video_id, transcript_id, chunk_index);
