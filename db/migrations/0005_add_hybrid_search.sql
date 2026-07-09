ALTER TABLE "bookmarks" ADD COLUMN "tsv_content" "tsvector";
CREATE INDEX IF NOT EXISTS "bookmarks_tsv_content_gin_idx" ON "bookmarks" USING GIN ("tsv_content");