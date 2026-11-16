CREATE TABLE "city_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_name" text,
	"name" text NOT NULL,
	"place_label" text NOT NULL,
	"state" text,
	"osm_type" text NOT NULL,
	"osm_id" bigint NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"note" text,
	"status" text DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	CONSTRAINT "city_requests_status_valid" CHECK ("city_requests"."status" in ('live', 'approved', 'removed'))
);
--> statement-breakpoint
CREATE INDEX "city_requests_status_idx" ON "city_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "city_requests_created_idx" ON "city_requests" USING btree ("created_at");