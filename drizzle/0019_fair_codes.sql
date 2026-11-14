CREATE TABLE "fair_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fair_codes_seen_idx" ON "fair_codes" USING btree ("seen_at");