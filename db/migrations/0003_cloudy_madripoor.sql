CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"ai_summary" text NOT NULL,
	"human_summary" text,
	"ai_tags" text[] NOT NULL,
	"human_tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "ai_content_summary" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "ai_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "ai_action_items" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;