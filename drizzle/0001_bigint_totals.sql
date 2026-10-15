ALTER TABLE "bookings" ALTER COLUMN "total_paise" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "line_total_paise" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_paise" SET DATA TYPE bigint;