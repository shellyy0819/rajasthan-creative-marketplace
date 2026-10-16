CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_lower_idx" ON "categories" USING btree (lower("name"));--> statement-breakpoint
-- data: the original four categories, plus any category already used by a product, before the foreign key is added
INSERT INTO "categories" ("name") VALUES ('Crochet & Textiles'), ('Accessories'), ('Resin Art'), ('Pottery') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "categories" ("name") SELECT DISTINCT "category" FROM "products" ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_categories_name_fk" FOREIGN KEY ("category") REFERENCES "public"."categories"("name") ON DELETE restrict ON UPDATE cascade;