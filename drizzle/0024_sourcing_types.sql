CREATE TABLE "sourcing_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"counts_as_handmade" boolean DEFAULT false NOT NULL,
	"show_badge" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Starter types. Existing products are NOT given a type: the column below is nullable with no default, so they stay unclassified until an admin sets one.
INSERT INTO "sourcing_types" ("id", "name", "counts_as_handmade", "show_badge", "position") VALUES
	(1, 'Handmade', true, false, 1),
	(2, 'Curated', false, true, 2),
	(3, 'Resold', false, true, 3);--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('sourcing_types', 'id'), 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sourcing_type_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "sourcing_types_name_lower_idx" ON "sourcing_types" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sourcing_type_id_sourcing_types_id_fk" FOREIGN KEY ("sourcing_type_id") REFERENCES "public"."sourcing_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_sourcing_idx" ON "products" USING btree ("sourcing_type_id");