CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_email" text NOT NULL,
	"workshop_id" text NOT NULL,
	"title" text NOT NULL,
	"attendee_name" text NOT NULL,
	"email" text NOT NULL,
	"quantity" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"status" text NOT NULL,
	"note" text NOT NULL,
	CONSTRAINT "bookings_quantity_positive" CHECK ("bookings"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "id_counters" (
	"prefix" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"seller" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"line_total_paise" integer NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_email" text NOT NULL,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"total_paise" integer NOT NULL,
	"status" text NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"city" text NOT NULL,
	"price_paise" integer NOT NULL,
	"seller" text NOT NULL,
	"description" text NOT NULL,
	"stock" integer NOT NULL,
	"status" text DEFAULT 'APPROVED' NOT NULL,
	"artist_name" text,
	"instagram" text,
	"youtube" text,
	"phone" text,
	"email" text,
	"image_url" text,
	CONSTRAINT "products_stock_nonneg" CHECK ("products"."stock" >= 0),
	CONSTRAINT "products_price_nonneg" CHECK ("products"."price_paise" >= 0),
	CONSTRAINT "products_status_valid" CHECK ("products"."status" in ('APPROVED', 'DRAFT'))
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"price_paise" integer NOT NULL,
	"city" text NOT NULL,
	"venue" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"seats" integer NOT NULL,
	"booked" integer DEFAULT 0 NOT NULL,
	"host" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'APPROVED' NOT NULL,
	CONSTRAINT "workshops_type_valid" CHECK ("workshops"."type" in ('FREE', 'PAID')),
	CONSTRAINT "workshops_price_nonneg" CHECK ("workshops"."price_paise" >= 0),
	CONSTRAINT "workshops_seats_positive" CHECK ("workshops"."seats" >= 1),
	CONSTRAINT "workshops_booked_range" CHECK ("workshops"."booked" >= 0 and "workshops"."booked" <= "workshops"."seats"),
	CONSTRAINT "workshops_status_valid" CHECK ("workshops"."status" in ('APPROVED', 'DRAFT'))
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workshops_status_idx" ON "workshops" USING btree ("status");