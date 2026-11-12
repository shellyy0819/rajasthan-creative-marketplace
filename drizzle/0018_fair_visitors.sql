CREATE TABLE "fair_visitors" (
	"code" text PRIMARY KEY NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"facing" text DEFAULT 'down' NOT NULL,
	"emote" text,
	"emote_seq" integer DEFAULT 0 NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_visitors_facing_valid" CHECK ("fair_visitors"."facing" in ('up', 'down', 'left', 'right'))
);
--> statement-breakpoint
CREATE INDEX "fair_visitors_seen_idx" ON "fair_visitors" USING btree ("seen_at");