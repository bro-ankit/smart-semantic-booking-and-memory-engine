-- Replace boolean is_completed with a nullable completed_at timestamp.
-- NULL = not done. A timestamp = done at that moment (audit trail for free).

-- 1. Add IF EXISTS so it doesn't crash if the column was already dropped on a failed run
ALTER TABLE "todos" DROP COLUMN IF EXISTS "is_completed";

--> statement-breakpoint

-- 2. Add IF NOT EXISTS so it doesn't crash if the column was already added on a failed run
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;