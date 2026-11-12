CREATE TABLE "fair_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"stall" text NOT NULL,
	"text" text NOT NULL,
	"rating" smallint DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_notes_rating_valid" CHECK ("fair_notes"."rating" between 0 and 5),
	CONSTRAINT "fair_notes_text_length" CHECK (char_length("fair_notes"."text") between 1 and 280),
	CONSTRAINT "fair_notes_source_valid" CHECK ("fair_notes"."source" in ('real', 'sample'))
);
--> statement-breakpoint
CREATE INDEX "fair_notes_created_idx" ON "fair_notes" USING btree ("created_at");