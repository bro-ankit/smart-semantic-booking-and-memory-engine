CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_url" text NOT NULL,
	"content_summary" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"embedding" vector(768),
	"status" text DEFAULT 'PENDING' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE  IF NOT EXISTS "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"task" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
    -- Check if the foreign key constraint already exists in the catalog
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'todos_bookmark_id_bookmarks_id_fk' 
          AND table_name = 'todos'
    ) THEN
        -- Safely add the constraint only if it's missing
        ALTER TABLE "todos" 
        ADD CONSTRAINT "todos_bookmark_id_bookmarks_id_fk" 
        FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") 
        ON DELETE cascade 
        ON UPDATE no action;
    END IF;
END $$;