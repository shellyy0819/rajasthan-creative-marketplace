ALTER TABLE "workshop_requests" DROP CONSTRAINT "workshop_requests_status_valid";--> statement-breakpoint
ALTER TABLE "workshop_requests" ALTER COLUMN "status" SET DEFAULT 'unverified';--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "code_hash" text;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "code_sends" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "code_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "workshop_requests_status_idx" ON "workshop_requests" USING btree ("status");--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_status_valid" CHECK ("workshop_requests"."status" in ('unverified', 'received'));