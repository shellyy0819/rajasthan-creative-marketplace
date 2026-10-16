ALTER TABLE "workshops" DROP CONSTRAINT "workshops_status_valid";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "seller_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ALTER COLUMN "host_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ALTER COLUMN "starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_seller_idx" ON "products" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "products_workshop_idx" ON "products" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "workshops_host_idx" ON "workshops" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "workshops_starts_idx" ON "workshops" USING btree ("starts_at");--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "user_email";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "user_email";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "seller";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "artist_name";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "instagram";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "youtube";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "workshops" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "workshops" DROP COLUMN "time";--> statement-breakpoint
ALTER TABLE "workshops" DROP COLUMN "host";--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_status_valid" CHECK ("workshops"."status" in ('APPROVED', 'DRAFT', 'ARCHIVED'));