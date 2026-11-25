CREATE TABLE "trend_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text,
	CONSTRAINT "trend_digests_status_valid" CHECK ("trend_digests"."status" in ('ok', 'empty', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "trend_digests_one_published_idx" ON "trend_digests" USING btree ((true)) WHERE "trend_digests"."published_at" is not null;--> statement-breakpoint
CREATE INDEX "trend_digests_created_idx" ON "trend_digests" USING btree ("created_at");