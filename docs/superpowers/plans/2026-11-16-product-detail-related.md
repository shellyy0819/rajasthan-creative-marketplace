# Product page: More from maker + Similar products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under every product on `/products/[slug]`, show "More from <maker>" (up to 4) and "Similar products" (up to 8, matching category first, then other categories).

**Architecture:** One server-side function `getRelatedProducts(product)` in a new module builds on `productsQuery`; one server component renders both sections and is mounted on the product page inside `<Suspense>`. No new route, no change to `listProducts`.

**Tech Stack:** Next.js (App Router, server components), Drizzle ORM + Postgres, Vitest + Testing Library. Read `node_modules/next/dist/docs/` for anything Next-specific you are unsure of (AGENTS.md: this Next version differs from older ones).

**Spec:** `docs/superpowers/specs/2026-11-16-product-detail-related-design.md`

## Global Constraints

- Only `APPROVED` products, newest first (`length(id) desc, id desc`, the order `getArtist` uses).
- Maker products: up to 4. Similar products: up to 8. Never show the current product, and never show the maker's own products in "Similar".
- "Matching category" = case-insensitive substring match in either direction; `%` and `_` in a category name are escaped (literal).
- Fallback: if fewer than 8 matching, fill with non-matching categories (still excluding current + maker's). Hide a section when its list is empty.
- Reuse `ProductGrid`; reuse existing classes (`section`, `section-heading`, `text-link`, `eyebrow`) and tokens only; no new colours or fonts, no inline styles.
- Run tests on Node 22 (`source ~/.nvm/nvm.sh && nvm use 22`). Commit messages: plain, no `Co-Authored-By` line.

## Review Focus

- A category name containing `%` or `_` (for example `100%`) must not match everything: pinned in Task 1.
- Category case differs (`paintings` vs `Paintings`) still matches: Task 1.
- Reverse containment (current `Oil Paintings`, other `Paintings`) matches: Task 1.
- A maker with no other products: "More from" is hidden, page still renders: Task 2.
- Nothing else in the whole catalogue: both sections hidden, no empty headings: Task 2.

---

### Task 1: `getRelatedProducts`

**Files:**
- Create: `src/lib/related-products.ts`
- Test: `tests/related-products.test.ts`

**Interfaces:**
- Consumes: `productsQuery(db)`, `toProduct` from `src/db/mappers.ts`; `products` from `src/db/schema.ts`; `artistIdPrefix` from `src/lib/artist-slug.ts`; `getDb` from `src/db/client.ts`; `Product` from `src/lib/types.ts`.
- Produces:
  ```ts
  export const MAKER_LIMIT = 4;
  export const SIMILAR_LIMIT = 8;
  export type Related = { fromMaker: Product[]; similar: Product[] };
  export async function getRelatedProducts(p: Product): Promise<Related>;
  ```

- [ ] **Step 1: Write the failing tests** in `tests/related-products.test.ts`. Setup: `beforeEach(resetTestDb)`; two sellers via `makeSeller('a@x.co', 'Studio A')` and `makeSeller('b@x.co', 'Studio B')`; categories `Paintings`, `Oil Paintings`, `Pottery`, `100%` created with `createCategory({ name }, 'a@x.co')` (`src/lib/categories.ts`); products created with `createProduct({ name, category, cityRef, pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED' }, seller.actor)` (`src/lib/admin.ts`, `cityRef` as in `tests/admin-posts-api.test.ts`); then `getProductBySlug(...)` / `listProducts()` to get the `Product` for the current one. Tests, by name:
  - `fromMaker lists the maker's other products, newest first, never the current one` (A has Paintings P1 (current), Pottery P2, Paintings P3 → `[P3, P2]`).
  - `fromMaker is capped at 4`.
  - `similar puts matching categories first, excludes the maker's own and the current product` (B: `Oil Paintings`, `Pottery`, `Paintings` → `[Paintings, Oil Paintings]` in newest-first order, then `Pottery` as fallback; A's products absent).
  - `matching is case-insensitive and works in both directions` (current `Oil Paintings` matches a `paintings`-named product; current `Paintings` matches `Oil Paintings`).
  - `a category named "100%" does not match everything` (current in `100%`: Pottery/Paintings of B are fallback-only, i.e. appear after, and with only fallback items `similar` still lists them; assert order puts a real `100%` product before them).
  - `similar is capped at 8 and fills from other categories when matches run out` (10 B products: 3 matching + 7 other → length 8, first 3 are the matches).
  - `draft and unapproved products never appear`.
  - `returns two empty lists when the catalogue has nothing else`.

- [ ] **Step 2: Run to verify failure:** `npx vitest run tests/related-products.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `getRelatedProducts(p: Product): Promise<Related>` in `src/lib/related-products.ts`.** `prefix = artistIdPrefix(p.sellerSlug ?? '')`; `makerWhere = sql\`replace(${products.sellerId}::text, '-', '') like ${prefix + '%'}\``. `fromMaker`: `productsQuery(db).where(and(eq(status,'APPROVED'), ne(products.id, p.id), makerWhere))` ordered newest-first, mapped with `toProduct`, then filtered to `x.sellerSlug === p.sellerSlug`, sliced to `MAKER_LIMIT`. `similar`: same base minus `not(makerWhere)`, two queries: one where `matches(p.category)` limit 8, then (if short) one where `not(matches)` with `notInArray(id, picked)` limit `8 - n`. `matches(name)` is a private SQL helper: `lower(products.category) like '%' || lower(esc(name)) || '%' escape '\' or lower(esc(name)) like '%' || lower(replace-escaped products.category) || '%' escape '\'`, where `esc` escapes `\`, `%`, `_` (JS function for the parameter; `regexp_replace` for the column side). If `prefix` is undefined, return `fromMaker: []` and skip the maker exclusion.

- [ ] **Step 4: Run tests:** `npx vitest run tests/related-products.test.ts` → all PASS.

- [ ] **Step 5: Commit:** `git add src/lib/related-products.ts tests/related-products.test.ts && git commit -m "feat: related products lookup for the product page"`

---

### Task 2: Sections on the product page

**Files:**
- Create: `src/components/RelatedProducts.tsx`
- Modify: `src/app/products/[slug]/page.tsx` (mount below the closing `</article>`, inside `<Suspense fallback={null}>`)
- Modify: `src/app/globals.css` (only if the existing section classes need a small spacing rule; append, no new tokens)
- Test: `tests/related-products-section.test.tsx`

**Interfaces:**
- Consumes: `getRelatedProducts`, `MAKER_LIMIT`, `SIMILAR_LIMIT` (Task 1); `ProductGrid` (`src/components/ProductGrid.tsx`); `Product`.
- Produces: `export async function RelatedProducts({ product }: { product: Product }): Promise<React.ReactElement | null>` (server component; null when both lists are empty).

- [ ] **Step 1: Write the failing test** `tests/related-products-section.test.tsx` (jsdom; mock `@/lib/related-products` to return fixed lists; mock `next/link`, `ProductCard`'s client children as other tests do, see `tests/trending-pages.test.tsx` header). Render `await RelatedProducts({ product })` and assert:
  - heading `More from Studio A` with a link `View all` to `/artists/<sellerSlug>`; heading `Similar products` with a link `See all <category>` to `/shop?category=<encoded category>`.
  - each list renders its product names.
  - `fromMaker` empty → no `More from` heading; `similar` empty → no `Similar products` heading; both empty → renders nothing (`container` empty).

- [ ] **Step 2: Run to verify failure:** `npx vitest run tests/related-products-section.test.tsx` → FAIL.

- [ ] **Step 3: Implement `RelatedProducts`** as an async server component: call `getRelatedProducts(product)`; for each non-empty list render `<section className="section" aria-labelledby=...>` with `<div className="section-heading"><div><span className="eyebrow">…</span><h2 id=…>…</h2></div><Link className="text-link" href=…>…</Link></div>` and `<ProductGrid products={list} />`. Use `encodeURIComponent` for the shop link. Use the maker's `seller` name for the heading.

- [ ] **Step 4: Mount it** in `src/app/products/[slug]/page.tsx` after `</article>`: `<Suspense fallback={null}><RelatedProducts product={p} /></Suspense>` (import `Suspense` from `react`).

- [ ] **Step 5: Run:** `npx vitest run tests/related-products-section.test.tsx tests/related-products.test.ts` → PASS; `npx tsc --noEmit` → no output.

- [ ] **Step 6: Look at it in the real app** against the local DB on a product with other products from the same maker (for example `/products/<any slug>` on `localhost:3000`, the user's dev server): both sections show, grid spacing matches the shop page, no console errors. (Local DB has dummy-photo products for most items.)

- [ ] **Step 7: Commit:** `git add src/components/RelatedProducts.tsx src/app/products src/app/globals.css tests/related-products-section.test.tsx && git commit -m "feat: more from the maker and similar products on the product page"`
