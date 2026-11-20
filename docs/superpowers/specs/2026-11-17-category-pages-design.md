# Category pages (SEO) and Amazon-style catalogue structure

Status: draft for approval (2026-11-17). Decisions so far from the owner: category pages match the category **exactly**; the database migration is run **locally first**.

## Intent

Search engines cannot index any product list by category today: `/shop?category=Crochet` is `noindex` and canonical to `/shop`, and categories have no address of their own. Big marketplaces win broad searches ("crochet products") with indexable category pages. Craftofy has city pages that already work this way; categories should too.

## Goals

- A real, indexable page per category with at least one approved product: `/categories/<slug>`, and a `/categories` index ("Shop by category") listing them with counts.
- Each category page: breadcrumb (Home › Categories › Name), one `h1`, a short intro, the product grid with pagination, its own canonical, and structured data (breadcrumb + item list).
- The "See all <category>" link, footer and home page link to the category page instead of `/shop?category=…`.
- Category pages in the sitemap.

## Non-goals

- No reviews, no "customers also bought", no product feed to Google Merchant (no purchase data; some products are "Price on request").
- No indexable filter combinations yet ("Crochet in Jaipur" comes later, only when a combination has enough products).
- No change to how `/shop` filters behave (they stay `noindex`, canonical `/shop`).

## Constraints from the codebase

- `categories` has `id`, `name` (unique, case-insensitive), `created_by`, `created_at`. `products.category` is a text FK to `categories.name` with `ON UPDATE CASCADE`, so a rename changes product rows automatically. A slug must therefore be **stored and stable**, not derived from the name on every request.
- At most 100 categories (`MAX_CATEGORIES`); sellers can create categories while onboarding, so names are user-supplied (slugs must be safe, unique, and never empty).
- City pages (`/cities/[city]`) are the pattern: only "active" ones exist, anything else is a 404.
- Migrations are drizzle (`db:generate`, `db:migrate`); latest is `0025`.
- The shop page size is 12 (`SHOP_PAGE_SIZE`).
- AGENTS.md: this Next.js version differs from older ones; read the relevant guides in `node_modules/next/dist/docs/` (metadata, sitemap, route params, `notFound`) before writing code.

## Approaches considered

1. **Stored slug + `/categories/<slug>` pages (chosen).** Stable addresses even when a name is edited; one clean place for canonical, sitemap and links. Costs one additive migration.
2. Derive the slug from the name at request time. No migration, but a rename breaks every link and indexed address, and two names can collide ("R&B" / "R B"). Rejected.
3. Make `/shop?category=X` indexable. No new pages, but it mixes with every other filter, creates duplicate and thin pages, and has no category-specific heading or text. Rejected.

## Design

### Data
- Add `categories.slug text not null` with a unique index. Backfill from the name: lower-case, accents folded, `&` to `and`, non-alphanumerics to `-`, trimmed; an empty result becomes `category`; clashes get `-2`, `-3`, in id order so the result is deterministic.
- New categories get a slug when created (inside the existing category lock), with the same rule. Renames keep the slug.
- Optional later: `description text` for an admin-written intro. The first version generates the intro from the name and the product count.

### Routes
- `/categories/[slug]`: 404 when the slug is unknown or the category has no approved product. Lists products where `products.category` equals the category name exactly (this is the owner's decision; the "includes" match stays only in the "Similar products" section of the product page).
- Pagination via `?page=N` (12 per page): page 1 canonical to the base address, other pages canonical to themselves, `rel` links left to search engines; `page` beyond the last returns 404.
- `/categories`: lists categories that have products, with counts, in a stable order. Indexable, canonical to itself.
- Any other query parameter (city, sort, source) on a category page: `noindex, follow`, canonical to the category page, matching how `/shop` works.

### Metadata and structured data
- Title "{Category}: Handmade products from Indian artisans" (wording comes from the catalogue wording helper so "handmade" is only used when true); description from the intro and counts.
- JSON-LD: `BreadcrumbList` and `ItemList` of the page's products (name, url). No `Product` markup on category pages.

### Links
- "See all {category}" on the product page (and the "Similar products" heading) goes to the category page.
- Footer and home page: a "Shop by category" block linking to the top categories.
- Product page breadcrumb becomes Home › {Category} › {Product} (links to the category page).
- Sitemap: `/categories` and every category page, `weekly`, with real last-modified dates once available.

## Order of work

1. Category pages, index, sitemap entries, "See all" links (this document).
2. Product page: breadcrumb through the category, richer product markup, permanent redirect from a wrong slug name part instead of a 404.
3. "Similar products" split into matching products and "More to explore"; category links on city pages.
4. Sitemap split by type with last-modified dates.
5. Measure in Search Console.

## Testing

- Slug backfill: accents, `&`, empty names, clashes (deterministic suffixes), idempotent re-run.
- Creating a category adds a unique slug; renaming keeps it.
- Category page: exact match only ("Crochet" does not list "Crochet & Textiles"), 404 for unknown or empty categories, pagination bounds, canonical and `noindex` rules for extra parameters, JSON-LD present.
- Sitemap contains the category pages and no filtered URLs.
- Local migration run on the local database (port 5434) first, with a check that existing queries still work; nothing is run on production data without the owner's go-ahead.

## Left to the builder

- Exact intro wording and the "Shop by category" block design (using the site's existing styles; per the owner's standing preference, new CSS goes in its own feature file).
- Whether `/categories` shows empty categories (default: no).

## Risks

- Near-duplicate category names ("Crochet" vs "Crochet & Textiles") will be separate, smaller pages; review and merge them in the admin area before launch.
- New pages take weeks to be crawled and indexed; do not expect quick ranking changes.
