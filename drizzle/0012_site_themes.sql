CREATE TABLE "site_themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"preset" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"config" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_themes_status_valid" CHECK ("site_themes"."status" in ('draft', 'scheduled', 'base')),
	CONSTRAINT "site_themes_window_order" CHECK ("site_themes"."ends_at" is null or "site_themes"."starts_at" is null or "site_themes"."ends_at" > "site_themes"."starts_at"),
	CONSTRAINT "site_themes_scheduled_dates" CHECK ("site_themes"."status" <> 'scheduled' or ("site_themes"."starts_at" is not null and "site_themes"."ends_at" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "site_themes_one_base_idx" ON "site_themes" USING btree ("status") WHERE "site_themes"."status" = 'base';--> statement-breakpoint
CREATE INDEX "site_themes_window_idx" ON "site_themes" USING btree ("starts_at");