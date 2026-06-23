CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"golden_question" text NOT NULL,
	"expected_topics" text[] NOT NULL,
	"expected_source_tag" text,
	"answer" text NOT NULL,
	"context_chunks" text[] NOT NULL,
	"relevance_score" double precision NOT NULL,
	"faithfulness_score" double precision NOT NULL,
	"reasoning" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
