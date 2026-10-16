CREATE TABLE "roles" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"public_phone" text,
	"public_email" text,
	"instagram" text,
	"youtube" text
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" smallint NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"google_sub" text,
	"name" text NOT NULL,
	"phone" text,
	"city" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seller_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "workshop_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pickup_location" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_by" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "host_id" uuid;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "host_name" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- ===== data backfill (hand-written; runs between the additive and the finalize migration) =====
INSERT INTO "roles" ("id", "name") VALUES (1, 'seller'), (2, 'admin') ON CONFLICT DO NOTHING;--> statement-breakpoint
-- The previous catalog had no owners; the owner asked for the existing products to be removed.
DELETE FROM "products";--> statement-breakpoint
INSERT INTO "users" ("email", "name")
  SELECT lower(e.email), e.name FROM (
    SELECT DISTINCT ON (lower(user_email)) user_email AS email, customer_name AS name FROM "orders" WHERE user_email <> ''
  ) e
  ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "users" ("email", "name")
  SELECT lower(e.email), e.name FROM (
    SELECT DISTINCT ON (lower(user_email)) user_email AS email, attendee_name AS name FROM "bookings" WHERE user_email <> ''
  ) e
  ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "users" ("email", "name") VALUES ('legacy@rangrajasthan.invalid', 'Legacy customer') ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "orders" o SET "user_id" = u."id" FROM "users" u
  WHERE lower(u."email") = CASE WHEN o."user_email" = '' THEN 'legacy@rangrajasthan.invalid' ELSE lower(o."user_email") END;--> statement-breakpoint
UPDATE "bookings" b SET "user_id" = u."id" FROM "users" u
  WHERE lower(u."email") = CASE WHEN b."user_email" = '' THEN 'legacy@rangrajasthan.invalid' ELSE lower(b."user_email") END;--> statement-breakpoint
UPDATE "workshops" SET "host_name" = "host", "starts_at" = (("date" || ' ' || "time")::timestamp AT TIME ZONE 'Asia/Kolkata');
