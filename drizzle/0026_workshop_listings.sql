CREATE TABLE "workshop_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"workshop_id" text NOT NULL,
	"label" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"sessions" integer,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "workshop_prices_amount_nonneg" CHECK ("workshop_prices"."amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workshop_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "workshop_topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "workshop_requests" DROP CONSTRAINT "workshop_requests_kind_valid";--> statement-breakpoint
ALTER TABLE "workshop_requests" DROP CONSTRAINT "workshop_requests_status_valid";--> statement-breakpoint
ALTER TABLE "workshops" DROP CONSTRAINT "workshops_seats_positive";--> statement-breakpoint
ALTER TABLE "workshops" DROP CONSTRAINT "workshops_booked_range";--> statement-breakpoint
ALTER TABLE "workshop_requests" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ALTER COLUMN "venue" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ALTER COLUMN "city_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ALTER COLUMN "venue" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ALTER COLUMN "seats" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "mode" text DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "ends_on" date;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "schedule" jsonb;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "experience" text;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "certifications" text;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "free_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "prices" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD COLUMN "listed_workshop_id" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "kind" text DEFAULT 'workshop' NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "mode" text DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "topic_id" integer;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "ends_on" date;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "schedule" jsonb;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "experience" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "certifications" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "free_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "source_request_id" uuid;--> statement-breakpoint
ALTER TABLE "workshop_prices" ADD CONSTRAINT "workshop_prices_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_topics" ADD CONSTRAINT "workshop_topics_parent_id_workshop_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."workshop_topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workshop_prices_workshop_idx" ON "workshop_prices" USING btree ("workshop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workshop_topics_name_lower_idx" ON "workshop_topics" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_topic_id_workshop_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."workshop_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_listed_workshop_id_workshops_id_fk" FOREIGN KEY ("listed_workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_topic_id_workshop_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."workshop_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workshops_topic_idx" ON "workshops" USING btree ("topic_id");--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_mode_valid" CHECK ("workshop_requests"."mode" in ('in_person', 'online'));--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_place_by_mode" CHECK ("workshop_requests"."mode" = 'online' or ("workshop_requests"."city" is not null and "workshop_requests"."venue" is not null));--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_kind_valid" CHECK ("workshop_requests"."kind" in ('workshop', 'meetup', 'popup', 'market', 'class'));--> statement-breakpoint
ALTER TABLE "workshop_requests" ADD CONSTRAINT "workshop_requests_status_valid" CHECK ("workshop_requests"."status" in ('unverified', 'received', 'listed'));--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_kind_valid" CHECK ("workshops"."kind" in ('workshop', 'meetup', 'popup', 'market', 'class'));--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_mode_valid" CHECK ("workshops"."mode" in ('in_person', 'online', 'hybrid'));--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_level_valid" CHECK ("workshops"."level" is null or "workshops"."level" in ('beginner', 'intermediate', 'advanced', 'all'));--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_place_by_mode" CHECK ("workshops"."mode" = 'online' or ("workshops"."city_id" is not null and "workshops"."venue" is not null));--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_seats_positive" CHECK ("workshops"."seats" is null or "workshops"."seats" >= 1);--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_booked_range" CHECK ("workshops"."booked" >= 0 and ("workshops"."seats" is null or "workshops"."booked" <= "workshops"."seats"));--> statement-breakpoint
INSERT INTO "workshop_topics" ("slug", "name", "position") VALUES ('yoga', 'Yoga', 1), ('crochet', 'Crochet', 2);
