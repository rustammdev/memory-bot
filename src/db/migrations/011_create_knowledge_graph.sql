CREATE TABLE knowledge_nodes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id       UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  type             TEXT NOT NULL,
  description      TEXT,
  importance       REAL NOT NULL DEFAULT 0,
  mention_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (channel_id, normalized_label)
);

CREATE TABLE knowledge_edges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  source_id    UUID NOT NULL REFERENCES knowledge_nodes (id) ON DELETE CASCADE,
  target_id    UUID NOT NULL REFERENCES knowledge_nodes (id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  weight       REAL NOT NULL DEFAULT 1.0,
  context      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (source_id, target_id, relationship)
);

CREATE TABLE node_video_references (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id    UUID NOT NULL REFERENCES knowledge_nodes (id) ON DELETE CASCADE,
  video_id   UUID NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
  chunk_id   UUID REFERENCES chunk_embeddings (id) ON DELETE SET NULL,
  context    TEXT,
  relevance  REAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (node_id, video_id, chunk_id)
);

CREATE INDEX idx_knowledge_nodes_channel ON knowledge_nodes (channel_id);
CREATE INDEX idx_knowledge_nodes_type ON knowledge_nodes (channel_id, type);
CREATE INDEX idx_knowledge_nodes_importance ON knowledge_nodes (channel_id, importance DESC);

CREATE INDEX idx_knowledge_edges_channel ON knowledge_edges (channel_id);
CREATE INDEX idx_knowledge_edges_source ON knowledge_edges (source_id);
CREATE INDEX idx_knowledge_edges_target ON knowledge_edges (target_id);

CREATE INDEX idx_node_refs_node ON node_video_references (node_id);
CREATE INDEX idx_node_refs_video ON node_video_references (video_id);
