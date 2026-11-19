ALTER TABLE "workshop_requests" ADD COLUMN "makes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "included" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "bring" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "min_age" integer;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "makes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "included" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "bring" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "min_age" integer;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_min_age_valid" CHECK ("workshop_requests"."min_age" is null or ("workshop_requests"."min_age" >= 1 and "workshop_requests"."min_age" <= 99));--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_min_age_valid" CHECK ("workshops"."min_age" is null or ("workshops"."min_age" >= 1 and "workshops"."min_age" <= 99));