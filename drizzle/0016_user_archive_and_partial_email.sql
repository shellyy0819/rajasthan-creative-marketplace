CREATE TABLE "user_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"google_sub" text,
	"reason" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"archived_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_archive_reason_valid" CHECK ("user_archive"."reason" in ('deactivated', 'deleted'))
);
--> statement-breakpoint
DROP INDEX "users_email_lower_idx";--> statement-breakpoint
CREATE INDEX "user_archive_user_idx" ON "user_archive" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email")) WHERE "users"."deleted_at" is null;