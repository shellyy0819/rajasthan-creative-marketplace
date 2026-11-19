ALTER TABLE "workshop_requests" ADD COLUMN "phone_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "phone_public" boolean DEFAULT false NOT NULL;