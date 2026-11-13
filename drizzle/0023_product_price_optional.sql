ALTER TABLE "products" DROP CONSTRAINT "products_price_nonneg";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price_paise" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_price_nonneg" CHECK ("products"."price_paise" is null or "products"."price_paise" >= 0);