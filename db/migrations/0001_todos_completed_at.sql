-- Replace boolean is_completed with a nullable completed_at timestamp.
-- NULL = not done. A timestamp = done at that moment (audit trail for free).
ALTER TABLE "todos" DROP COLUMN "is_completed";
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "completed_at" timestamp with time zone;
