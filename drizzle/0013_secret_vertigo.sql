ALTER TABLE "seller_profiles" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "contact_methods" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
UPDATE "seller_profiles" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
