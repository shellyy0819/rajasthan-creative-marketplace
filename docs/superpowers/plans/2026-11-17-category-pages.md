# Category pages (SEO) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every category with approved products its own indexable page at `/categories/<slug>`, a `/categories` index, sitemap entries, and links to them, so search engines can index category lists (today only `noindex` `/shop?category=…` exists).

**Architecture:** A stored, stable `categories.slug` (made by the database itself: one SQL function used by a trigger and by the one-off backfill, so there is one source of truth and direct inserts still get a slug). A small library (`category-pages.ts`) reads categories and their products through the existing `listProducts` / `countProducts` (exact category match). Two server pages render them; links and the sitemap point at them.

**Tech Stack:** Next.js (App Router, server components), Drizzle ORM + Postgres (pglite in tests), Vitest + Testing Library. **Read the relevant guides in `node_modules/next/dist/docs/` (metadata, route params and `searchParams` as promises, `notFound`, sitemap) before writing any page code** (AGENTS.md: this Next version differs from older ones).

**Spec:** `docs/superpowers/specs/2026-11-17-category-pages-design.md`

## Global Constraints

- Category pages list products whose `products.category` equals the category name **exactly** (owner's decision). The "includes" match stays only in the product page's "Similar products".
- Only categories with at least one `APPROVED` product have a page; any other slug is a 404 (same rule as `/cities/[city]`).
- Slugs are stored and stable: a rename never changes a slug. They are made in the database only (never in TypeScript), unique, never empty (`category`, `category-2`, … when a name gives nothing).
- Page size is `SHOP_PAGE_SIZE` (12). `?page=1` or no `page` is the base address; page N > last page, `page=0`, `page=abc` are 404 (not clamped).
- Extra query parameters other than `page` (city, sort, source, q, …) on a category page: `noindex, follow`, canonical to the category page (the `/shop` rule). Page 1 canonicalises to the base address; page N to itself.
- Wording: use `getCatalogWording()` and `capitalize`, as the shop page does, so "handmade" is only claimed when true.
- New CSS goes in its own feature file (`src/app/categories/categories.css`, imported by the pages), not `globals.css` (owner's standing preference); no inline styles, no new colours or fonts, reuse existing classes (`page-head`, `eyebrow`, `section`, `section-heading`, `text-link`, `button`) first. `tests/typography.test.ts` applies to every stylesheet.
- Migration is run on the **local** database (port 5434, `.env.local`) first; nothing is run on production data without the owner's go-ahead. Never touch `.env.backend`.
- Run tests on Node 22 (`source ~/.nvm/nvm.sh && nvm use 22`). Commit messages: plain, no `Co-Authored-By` line. Work on a new branch off `production`: `feat/category-pages`.

## Review Focus

- Two categories that slugify the same ("R&B" / "R B") get `-2`, in id order, deterministically: Task 1.
- A category name with no Latin letters (Hindi) gets `category`, `category-2`, never an empty or duplicate slug: Task 1.
- A rename keeps the slug; products still list under it: Task 1 and Task 2.
- "Crochet" never lists "Crochet & Textiles" products (exact match): Task 2.
- A category whose products are all drafts or unapproved: 404 and absent from the index and sitemap: Tasks 2, 3, 4, 5.
- `?page=99`, `?page=0`, `?page=abc`: 404; `?page=1`: canonical is the base address: Task 3.
- `?city=jaipur` on a category page: `noindex`, canonical to the category page: Task 3.
- A direct `insert into categories (name)` (tests, seed, scripts) still gets a unique slug: Task 1.

---

### Task 1: Slug column, database function, trigger, backfill

**Files:**
- Create: `drizzle/0026_category_slugs.sql` (hand-written; add its entry to `drizzle/meta/_journal.json` with `idx: 26`, `tag: "0026_category_slugs"`, `when` a later timestamp, `version: "7"`, `breakpoints: true`; generate the snapshot only if `drizzle-kit generate` is run for the schema change, otherwise copy the 0025 snapshot's shape with the new column)
- Modify: `src/db/schema.ts` (`categories`: add `slug: text('slug').notNull().default('')`, and a unique index on `slug` where `slug <> ''`)
- Test: `tests/category-slugs.test.ts`

**Interfaces:**
- Produces (SQL): `category_slug_unique(name text, exclude_id int) returns text`; trigger `categories_set_slug` (BEFORE INSERT, fills `slug` when it is `''`/null); `category_backfill_slugs() returns void` (fills rows whose slug is `''`, in id order).
- Produces (TS): `categories.slug` in the Drizzle schema.

- [ ] **Step 1: Write the failing tests** in `tests/category-slugs.test.ts` (use `resetTestDb`, `getTestDb`, insert into `categories` directly as `tests/related-products.test.ts` does). Test names:
  - `a new category gets a lowercase, hyphenated slug` (`Oil Paintings` → `oil-paintings`).
  - `& becomes "and", accents are folded, punctuation collapses` (`Arts & Crafts` → `arts-and-crafts`; `Café Décor` → `cafe-decor`; `Pots, Pans / Jars` → `pots-pans-jars`).
  - `names that slugify the same get -2, -3 in insert order` (`R&B`, `R B`… use names that collide, e.g. `Home Decor` and `Home-Decor` → `home-decor`, `home-decor-2`).
  - `a name with no Latin letters gets category, category-2` (two Hindi names).
  - `renaming keeps the slug` (update `name`; slug unchanged).
  - `slug is unique` (direct update to a duplicate throws).
  - `backfill fills existing rows deterministically and is idempotent` (disable the trigger with `ALTER TABLE categories DISABLE TRIGGER categories_set_slug`, insert rows with `slug` `''` including a clash, call `select category_backfill_slugs()`, assert slugs in id order; call again, assert unchanged; re-enable the trigger).
  - `the launch categories already have slugs after migration` (select the seeded/default categories; none has an empty slug).

- [ ] **Step 2: Run to verify failure:** `npx vitest run tests/category-slugs.test.ts` → FAIL (column and functions missing).

- [ ] **Step 3: Implement the migration** in `drizzle/0026_category_slugs.sql`: `ALTER TABLE categories ADD COLUMN slug text NOT NULL DEFAULT ''`; `category_slug_base(text)` (lower-case, `&`→`and`, `translate()` of common accented letters to ASCII, non-`[a-z0-9]` runs → `-`, trim `-`, empty → `category`); `category_slug_unique(name, exclude_id)` (base, then `base-2`, `base-3`… until no other row has it); `category_backfill_slugs()` (loop rows with `slug = ''` ordered by id, update each with `category_slug_unique`); `categories_set_slug()` trigger function; run the backfill; create the partial unique index; create the trigger last. Mirror the column and index in `src/db/schema.ts`. Use plpgsql (supported by pglite).

- [ ] **Step 4: Run tests:** `npx vitest run tests/category-slugs.test.ts tests/categories.test.ts` → PASS (existing category tests prove inserts still work).

- [ ] **Step 5: Run the migration on the local database** (`npm run db:migrate` against `.env.local`, port 5434): then `psql` select of `name, slug` for all categories; read the list with the owner before continuing.

- [ ] **Step 6: Commit:** `git add drizzle src/db/schema.ts tests/category-slugs.test.ts && git commit -m "feat: stable slug for every category (database-made, unique)"`

---

### Task 2: Category library

**Files:**
- Create: `src/lib/category-pages.ts`
- Test: `tests/category-pages.test.ts`

**Interfaces:**
- Consumes: `listProducts`, `countProducts` (`src/lib/catalog.ts`), `SHOP_PAGE_SIZE` (`src/lib/catalog-shared.ts`), `categories` schema, `getDb`.
- Produces:
  ```ts
  export type CategoryEntry = { name: string; slug: string; count: number };
  export async function listCategoryIndex(): Promise<CategoryEntry[]>;          // only categories with >= 1 APPROVED product, sorted by name (case-insensitive)
  export async function getCategoryEntry(slug: string): Promise<CategoryEntry | undefined>; // undefined when unknown or no APPROVED product
  export async function slugForCategory(name: string): Promise<string | undefined>;       // for links; undefined when the category has no page
  export async function listCategoryPage(entry: CategoryEntry, page: number): Promise<{ products: Product[]; total: number; pages: number }>;
  ```

- [ ] **Step 1: Write the failing tests** (setup as `tests/related-products.test.ts`: two sellers, categories `Crochet`, `Crochet & Textiles`, `Pottery`, products via `createProduct` as admin). Names:
  - `lists only categories that have approved products, sorted by name`.
  - `a category whose products are all drafts has no entry and no page`.
  - `getCategoryEntry finds by slug and returns the product count`.
  - `exact match: Crochet does not list Crochet & Textiles products`.
  - `listCategoryPage returns 12 per page, newest first, with total and page count` (create 14 products).
  - `a renamed category keeps its slug and its products`.
  - `slugForCategory returns the slug, or undefined for a category with no products`.

- [ ] **Step 2: Run to verify failure:** `npx vitest run tests/category-pages.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/lib/category-pages.ts`. Counts come from one grouped query over `products` (`status = 'APPROVED'`) joined to `categories` on name; the page list calls `listProducts({ category: entry.name, limit: SHOP_PAGE_SIZE, offset })` and `countProducts({ category: entry.name })`; `pages = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE))`.

- [ ] **Step 4: Run tests:** → PASS.

- [ ] **Step 5: Commit:** `git add src/lib/category-pages.ts tests/category-pages.test.ts && git commit -m "feat: category library (index, entry by slug, paged products)"`

---

### Task 3: Category page `/categories/[slug]`

**Files:**
- Create: `src/app/categories/[slug]/page.tsx`, `src/app/categories/categories.css`, `src/components/CategoryPagination.tsx`
- Test: `tests/category-page.test.tsx`

**Interfaces:**
- Consumes: Task 2 functions; `Breadcrumbs`, `JsonLd`, `ProductGrid`; `breadcrumbJsonLd` (`src/lib/jsonld.ts`, add `categoryJsonLd(name, path, products)` there returning a `CollectionPage` with an `ItemList` of product names and `abs()` urls); `pageMetadata` (`src/lib/meta.ts`); `getCatalogWording`, `capitalize`.
- Produces: `export default async function CategoryPage({ params, searchParams })`, `generateMetadata`; `CategoryPagination({ base: string; page: number; pages: number })` rendering `<nav aria-label="Pages">` with real links (`?page=N`, none for page 1 → base) and `rel="prev"` / `rel="next"`.

- [ ] **Step 1: Write the failing tests.** Render the async page like `tests/sourcing-tag.test.tsx` renders the product page (`renderToStaticMarkup(await Page({ params, searchParams }))`), with the DB set up as in Task 2. Names:
  - `shows the h1, breadcrumb Home › Categories › Name, the intro and the products`.
  - `404s (notFound) for an unknown slug and for a category with no approved products`.
  - `page 2 shows the next products; ?page=0, ?page=abc and a page past the end are 404; ?page=1 renders page 1`.
  - `metadata: canonical is the base address for page 1 and ?page=N for page N; no noindex`.
  - `metadata: any other parameter (city, sort, q) gives noindex, follow and canonical to the category page`.
  - `pagination links are real links, prev/next only where they exist`.
  - `JSON-LD has a breadcrumb and an item list of this page's products`.
  - `the title uses the catalogue wording` (neutral wording → "Products", not "Handmade").

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement the page** following `src/app/cities/[city]/page.tsx` (async params/`searchParams` promises, `dynamic = 'force-dynamic'`, `notFound()`); `page` parsing: only a plain positive integer string is accepted; anything else (or > pages) → `notFound()`. Metadata via `pageMetadata({ title, description, path, noindex })` where `path` is `/categories/<slug>` (+ `?page=N` for N > 1) and `noindex` is true when any key other than `page` is present (then `path` is the base). Import `./categories.css` in the page; classes reuse existing ones, new ones are prefixed `cat-`.

- [ ] **Step 4: Run tests:** `npx vitest run tests/category-page.test.tsx tests/typography.test.ts` → PASS; `npx tsc --noEmit` → no output.

- [ ] **Step 5: Look at it** in the real app against the local database (`/categories/<slug>` for a category with products, page 2, a bad page, a filter parameter): headings, grid spacing, pagination, no console errors.

- [ ] **Step 6: Commit:** `git add src/app/categories src/components/CategoryPagination.tsx src/lib/jsonld.ts tests/category-page.test.tsx && git commit -m "feat: indexable category page with pagination and structured data"`

---

### Task 4: Category index `/categories`

**Files:**
- Create: `src/app/categories/page.tsx`
- Test: `tests/categories-index.test.tsx`

**Interfaces:**
- Consumes: `listCategoryIndex`; `Breadcrumbs`, `JsonLd`, `pageMetadata`; `./categories.css`.
- Produces: `export default async function CategoriesPage()` and `generateMetadata`; canonical `/categories`; breadcrumb Home › Categories; a list of links `/categories/<slug>` with the product count each; an empty-state message when there are none.

- [ ] **Step 1: Failing tests:** `lists categories with product counts as links, sorted by name`; `leaves out categories with no approved products`; `shows a message when there are no categories`; `has a breadcrumb and a canonical to itself`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests + `npx tsc --noEmit`.**
- [ ] **Step 5: Commit:** `git add src/app/categories/page.tsx tests/categories-index.test.tsx && git commit -m "feat: categories index page (Shop by category)"`

---

### Task 5: Sitemap and links

**Files:**
- Modify: `src/app/sitemap.ts`, `src/components/RelatedProducts.tsx` (the "See all {category}" link), `src/components/Footer.tsx` (a "Categories" link next to Sitemap)
- Create: `src/components/ShopByCategory.tsx` (server component: up to 8 categories as links, newest products first or by count, plus "All categories →")
- Modify: `src/app/page.tsx` (mount `ShopByCategory`)
- Test: `tests/category-links.test.tsx`

**Interfaces:**
- Consumes: `listCategoryIndex`, `slugForCategory`.
- Produces: sitemap entries `/categories` and `/categories/<slug>` (`changeFrequency: 'weekly'`, priority 0.8 for categories, 0.7 each); `ShopByCategory(): Promise<ReactElement | null>` (null when no categories).

- [ ] **Step 1: Failing tests:** `the sitemap lists /categories and every category page, and no filtered shop address`; `the "See all {category}" link on the product page goes to /categories/<slug> (not /shop?category=)` (extend the existing `tests/related-products-section.test.tsx` expectations; the link falls back to `/shop?category=…` only when the category has no page); `ShopByCategory renders links to category pages and renders nothing with no categories`; `the footer links to /categories`.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** (RelatedProducts is async already: look the slug up with `slugForCategory(product.category)`).
- [ ] **Step 4: Run:** the new tests, `tests/related-products-section.test.tsx`, `tests/related-products.test.ts`, `tests/typography.test.ts`; `npx tsc --noEmit` → no output.
- [ ] **Step 5: Run the whole suite** and read every failure by name: known pre-existing failures on `production` (fair, home "Explore by city", several DB tests under load) are to be listed, anything else fixed.
- [ ] **Step 6: Commit:** `git add src tests && git commit -m "feat: category pages in the sitemap and linked from the product page, footer and home"`

---

### After the tasks

- Push `feat/category-pages` and open a PR against `production` (no attribution lines). The PR description must say: the migration `0026` runs on deploy, what it does (additive column, function, trigger, backfill), and that near-duplicate category names become separate pages.
- Production migration only after the owner's go-ahead.
- Follow-up plans (separate): product-page breadcrumb and redirect for a wrong slug name part; "Similar products / More to explore" split; sitemap split by type with last-modified dates.
