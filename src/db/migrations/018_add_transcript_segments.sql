-- Store timed transcript segments alongside raw text
-- segments = [{startSec, endSec, text}, ...] from VTT parsing
-- Enables "watch at 3:45" style references in chat

ALTER TABLE transcripts ADD COLUMN segments JSONB;

-- Add start timestamp to chunk embeddings so search results can link to video time
ALTER TABLE chunk_embeddings ADD COLUMN start_sec REAL;
