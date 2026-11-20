ALTER TABLE "categories" ADD COLUMN "slug" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE FUNCTION category_slug_base(n text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  select coalesce(nullif(trim(both '-' from regexp_replace(
    translate(lower(replace(n, '&', ' and ')), 'áàâäãåéèêëíìîïóòôöõúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy'),
    '[^a-z0-9]+', '-', 'g')), ''), 'category')
$$;--> statement-breakpoint
CREATE FUNCTION category_slug_unique(n text, exclude_id integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  base text := category_slug_base(n);
  cand text := base;
  i integer := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM categories WHERE slug = cand AND id <> coalesce(exclude_id, -1)) LOOP
    i := i + 1;
    cand := base || '-' || i;
  END LOOP;
  RETURN cand;
END
$$;--> statement-breakpoint
CREATE FUNCTION category_backfill_slugs() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id, name FROM categories WHERE slug = '' ORDER BY id LOOP
    UPDATE categories SET slug = category_slug_unique(r.name, r.id) WHERE id = r.id;
  END LOOP;
END
$$;--> statement-breakpoint
CREATE FUNCTION categories_set_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := category_slug_unique(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
SELECT category_backfill_slugs();--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug") WHERE "categories"."slug" <> '';--> statement-breakpoint
CREATE TRIGGER categories_set_slug BEFORE INSERT ON categories FOR EACH ROW EXECUTE FUNCTION categories_set_slug();
