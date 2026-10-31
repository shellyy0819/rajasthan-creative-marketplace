CREATE TABLE "listing_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"instagram" text,
	"website" text,
	"business_name" text NOT NULL,
	"size" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_requests_size_valid" CHECK ("listing_requests"."size" in ('small', 'medium', 'large')),
	CONSTRAINT "listing_requests_status_valid" CHECK ("listing_requests"."status" in ('received', 'confirmed'))
);
--> statement-breakpoint
ALTER TABLE "listing_requests" ADD CONSTRAINT "listing_requests_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_requests_created_idx" ON "listing_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "listing_requests_status_idx" ON "listing_requests" USING btree ("status");