CREATE TABLE "product_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_events_type_valid" CHECK ("product_events"."type" in ('view', 'contact', 'artist'))
);
--> statement-breakpoint
CREATE TABLE "product_likes" (
	"product_id" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_likes_product_id_actor_pk" PRIMARY KEY("product_id","actor")
);
--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_likes" ADD CONSTRAINT "product_likes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_events_unique_idx" ON "product_events" USING btree ("product_id","type","actor","day");--> statement-breakpoint
CREATE INDEX "product_events_day_idx" ON "product_events" USING btree ("day");--> statement-breakpoint
CREATE INDEX "product_likes_created_idx" ON "product_likes" USING btree ("created_at");