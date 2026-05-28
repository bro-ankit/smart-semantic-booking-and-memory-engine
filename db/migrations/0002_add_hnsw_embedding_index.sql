-- HNSW index for cosine similarity search on bookmark embeddings.
--
-- Why HNSW over IVFFlat:
--   IVFFlat clusters data at build time. On an empty table the clusters center
--   on empty space and degrade as real data arrives, requiring a REINDEX.
--   HNSW builds a navigable small-world graph incrementally, so it stays
--   accurate from the first row inserted and never needs manual re-indexing.
--
-- Tuning knobs (revisit with production query latency data):
--   m               = max connections per node per layer (default 16)
--   ef_construction = candidate list size during build (default 64)
CREATE INDEX IF NOT EXISTS "bookmarks_embedding_hnsw_idx"
    ON "bookmarks"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);