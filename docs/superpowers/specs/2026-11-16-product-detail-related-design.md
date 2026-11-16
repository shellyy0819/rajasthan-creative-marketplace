# Product page: "More from maker" and "Similar products"

Status: approved by the owner in conversation (2026-11-16), with one change: when a category is thin, fall back to other categories.

## Intent

A buyer who opens a product page and likes it, but not quite enough to contact the maker, has nothing else to look at. Two new sections keep them browsing: more from the same maker, then similar products.

## Goals

- Under the product, show "More from <maker name>": the maker's other approved products, excluding the current one. Up to 4, "View all" links to the maker's page. Hidden when the maker has no others.
- Then "Similar products": other approved products of a matching category (see Category matching), excluding the current product and the maker's own products (already shown above). Up to 8, "See all <category>" links to `/shop?category=<category>`.
- If the category has fewer than 8 such products, fill the rest with products from other categories (newest first), still excluding the current product and the maker's products. The section is hidden only when nothing is left.
- Reuse `ProductGrid` / `ProductCard`.

## Non-goals

- No new endpoint, no recommendation engine, no tags or text similarity.
- No change to the product page layout redesign (separate mockup work).
- No ranking by likes or views.

## Constraints

- Public `Product` data has `sellerSlug` but no seller id, so the maker filter works on the slug (same `artistSlug` rule the artist page uses).
- Only `APPROVED` products, as everywhere else.
- Both lists load after the main product content so the page is not held up (Suspense).

## Approach

Add `src/lib/related-products.ts` with one function, `getRelatedProducts(product)`, returning `{ fromMaker, similar }`. It builds on the existing `productsQuery` (the same join `listProducts` and `getArtist` use), so `listProducts` and its filter type stay untouched. Considered and rejected: a separate API route (nothing outside the page needs it), and matching on text similarity (overkill, slower, less predictable than category).

## Category matching

"Same category" uses an includes match, not equality: two categories match when, ignoring case, either name contains the other ("Paintings" matches "Oil Paintings" and "Paintings & Prints"). The check is a case-insensitive substring test in SQL; `%` and `_` inside a category name are escaped so they are literal.

## Fallback order for "Similar products"

1. Matching category (above), newest first.
2. Then other categories, newest first, until 8.

## Left to the builder

- Exact SQL for the seller filter (match on the computed slug, or add a seller id column to the query).
- Section headings' markup and the "View all" / "See all" link styling, using existing classes.
- Tests: filter behaviour, exclusion rules, fallback fill, hidden-when-empty.
