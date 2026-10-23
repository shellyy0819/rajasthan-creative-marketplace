CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_type" text,
	"osm_id" bigint,
	"name" text NOT NULL,
	"state" text,
	"slug" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cities_osm_idx" ON "cities" USING btree ("osm_type","osm_id");
--> statement-breakpoint
INSERT INTO "cities" ("name", "state", "slug", "lat", "lng") VALUES
	('Udaipur', 'Rajasthan', 'udaipur', 24.5854, 73.7125),
	('Jaipur', 'Rajasthan', 'jaipur', 26.9124, 75.7873),
	('Jodhpur', 'Rajasthan', 'jodhpur', 26.2389, 73.0243);
--> statement-breakpoint
DO $$
DECLARE
	r record;
	base text;
	candidate text;
	n integer;
BEGIN
	FOR r IN
		SELECT min(trimmed) AS name FROM (
			SELECT btrim(city) AS trimmed FROM "products"
			UNION ALL SELECT btrim(city) FROM "workshops"
			UNION ALL SELECT btrim(city) FROM "seller_profiles"
			UNION ALL SELECT btrim(city) FROM "users"
		) t
		WHERE trimmed IS NOT NULL AND trimmed <> ''
		GROUP BY lower(trimmed)
		HAVING NOT EXISTS (SELECT 1 FROM "cities" c WHERE lower(c.name) = lower(min(trimmed)))
		ORDER BY lower(min(trimmed))
	LOOP
		base := btrim(lower(regexp_replace(r.name, '[^a-z0-9]+', '-', 'gi')), '-');
		IF base = '' THEN base := 'city'; END IF;
		candidate := base;
		n := 1;
		WHILE EXISTS (SELECT 1 FROM "cities" WHERE slug = candidate) LOOP
			n := n + 1;
			candidate := base || '-' || n;
		END LOOP;
		INSERT INTO "cities" ("name", "slug") VALUES (r.name, candidate);
	END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "city_id" integer;
--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "city_id" integer;
--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "city_id" integer;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city_id" integer;
--> statement-breakpoint
UPDATE "products" SET "city_id" = (SELECT c.id FROM "cities" c WHERE lower(c.name) = lower(btrim("products".city)) ORDER BY c.id LIMIT 1) WHERE btrim(city) <> '';
--> statement-breakpoint
UPDATE "workshops" SET "city_id" = (SELECT c.id FROM "cities" c WHERE lower(c.name) = lower(btrim("workshops".city)) ORDER BY c.id LIMIT 1) WHERE btrim(city) <> '';
--> statement-breakpoint
UPDATE "seller_profiles" SET "city_id" = (SELECT c.id FROM "cities" c WHERE lower(c.name) = lower(btrim("seller_profiles".city)) ORDER BY c.id LIMIT 1) WHERE btrim(city) <> '';
--> statement-breakpoint
UPDATE "users" SET "city_id" = (SELECT c.id FROM "cities" c WHERE lower(c.name) = lower(btrim("users".city)) ORDER BY c.id LIMIT 1) WHERE btrim(city) <> '';
--> statement-breakpoint
DO $$
DECLARE n integer;
BEGIN
	SELECT count(*) INTO n FROM "products" WHERE city_id IS NULL;
	IF n > 0 THEN
		RAISE EXCEPTION 'cities migration: % products have a blank city; fix them first', n;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "city_id" SET NOT NULL;
--> statement-breakpoint
DO $$
DECLARE n integer;
BEGIN
	SELECT count(*) INTO n FROM "workshops" WHERE city_id IS NULL;
	IF n > 0 THEN
		RAISE EXCEPTION 'cities migration: % workshops have a blank city; fix them first', n;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "workshops" ALTER COLUMN "city_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "products_city_idx" ON "products" USING btree ("city_id");
--> statement-breakpoint
CREATE INDEX "seller_profiles_city_idx" ON "seller_profiles" USING btree ("city_id");
--> statement-breakpoint
CREATE INDEX "users_city_idx" ON "users" USING btree ("city_id");
--> statement-breakpoint
CREATE INDEX "workshops_city_idx" ON "workshops" USING btree ("city_id");
--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "city";
--> statement-breakpoint
ALTER TABLE "seller_profiles" DROP COLUMN "city";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "city";
--> statement-breakpoint
ALTER TABLE "workshops" DROP COLUMN "city";
