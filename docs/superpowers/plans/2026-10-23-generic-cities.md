# Generic Cities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Udaipur/Jaipur/Jodhpur list with a `cities` table so any Indian city can be used by products, workshops, seller profiles and users.

**Architecture:** A `cities` table (unique by OSM id) is the single source of truth; every city field becomes a foreign key. Makers pick a city through the existing Photon place search; the server signs each search result, and writes accept only a signed `cityRef` or an existing `cityId`, so free text can never create a city. Listing surfaces (footer, home links, sitemap, filters, `/cities/<slug>`) are derived from cities that have approved products or workshops.

**Tech Stack:** Next.js 16 (breaking changes: read `node_modules/next/dist/docs/` before touching routes or pages, see AGENTS.md), Drizzle ORM on Postgres, PGlite for tests, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-generic-cities-design.md`

## Global Constraints

- Any Indian city is valid. No admin approval step for cities.
- A city is identified by its OSM id (`osm_type` + `osm_id`); display is name plus state.
- Accepted place types: city, town, village (Photon `osm_value`), nothing else.
- Free text must never create a city; only a signed `cityRef` from the place search, or an existing `cityId`.
- All of these reference `cities`: `products`, `workshops`, `seller_profiles` (artist city), `users`. None stays free text.
- Existing slugs `udaipur`, `jaipur`, `jodhpur` stay unchanged (state Rajasthan). First city to claim a bare slug keeps it; a namesake gets `<name>-<state>` slugified.
- `/cities/<slug>` exists only for cities with at least one APPROVED product or workshop; any other slug is a 404. (Author's call: an artist-only city has nothing to render, so artists alone do not make a city active.)
- Nearby cities: at most 5 active cities within 300 km, nearest first; if none, return all active cities.
- `?city=Udaipur` and `?city=udaipur` keep working (matched by name or slug).
- Migration never fails on unknown existing city values: trim, match case-insensitively, create a row (no coordinates) for each distinct value; blank becomes null.
- Place search outage: forms show an error and keep the previous city; never accept free text.
- Keep Photon cache and fair-use behavior. Follow the `rang-rajasthan-design` skill for any new UI.
- Existing tests are updated, not deleted. Commit after each task.

## Review Focus

- Two cities with the same name in different states: distinct slugs, first keeps the bare slug (Task 2).
- Forged, tampered or expired `cityRef`: 400, no `cities` row created (Task 3).
- Photon returns a village/locality or a result with no coordinates: village accepted, locality rejected, missing coordinates rejected (Task 3).
- Old or unknown `?city=` values: no 500, unknown finds nothing, old name/slug values still filter (Task 4).
- A city whose last product or workshop is archived or deleted: vanishes from footer, home links and sitemap, and its page 404s (Task 6).
- Nearest-city lookup with rows lacking coordinates, and with nothing within 300 km (Task 7).

---

### Task 1: `cities` table, foreign keys and migration

**Files:**
- Modify: `src/db/schema.ts` (add `cities`; add `cityId` to `products`, `workshops`, `sellerProfiles`, `users`; remove their `city` text columns)
- Create: `drizzle/0009_cities.sql` (via `npm run db:generate`, then hand-edit the backfill), updated `drizzle/meta/*`
- Modify: `tests/db-schema.test.ts`

**Interfaces:**
- Produces: `cities` table with columns `id serial pk`, `osmType text null`, `osmId bigint null`, `name text not null`, `state text null`, `slug text not null unique`, `lat double precision null`, `lng double precision null`, unique index on `(osm_type, osm_id)`, `createdAt`. FK columns `city_id integer` on `products` and `workshops` (not null, `onDelete: 'restrict'`), and on `seller_profiles` and `users` (null, `onDelete: 'set null'`), each indexed. Exports `cities` and type `CityRow = typeof cities.$inferSelect`.

- [ ] **Step 1: Write failing tests** in `tests/db-schema.test.ts` against a freshly migrated PGlite: `it('creates Udaipur, Jaipur and Jodhpur in Rajasthan with their old slugs and coordinates')` (three rows, slugs `udaipur|jaipur|jodhpur`, state `Rajasthan`, non-null lat/lng); `it('rejects two cities with the same osm type and id')`; `it('rejects a product without a city')`.
- [ ] **Step 2: Run** `npx vitest run tests/db-schema.test.ts`. Expected: FAIL (no `cities` table).
- [ ] **Step 3: Implement** the schema change, run `npm run db:generate`, then edit `drizzle/0009_cities.sql` so the order is: create `cities`; insert the three launch cities (Udaipur 24.5854/73.7125, Jaipur 26.9124/75.7873, Jodhpur 26.2389/73.0243, state Rajasthan, bare slugs); for each distinct trimmed, case-insensitively-deduplicated existing text value in the four tables not already present, insert a city (null state/coords, slug from `lower(regexp_replace(name,'[^a-z0-9]+','-','gi'))`, trimmed of dashes, suffixed with `-2`, `-3` on collision); add `city_id` columns, fill them by case-insensitive name match (blank to null); set `NOT NULL` on products/workshops; drop the old `city` columns.
- [ ] **Step 4: Run** the same test plus `npx vitest run tests/db-schema.test.ts tests/catalog.test.ts`. Expected: schema tests PASS; catalog tests fail until Task 4 (expected).
- [ ] **Step 5: Commit** `git commit -m "feat: cities table and city foreign keys"`.

### Task 2: Cities library (slug, lookup, active list, nearest)

**Files:**
- Create: `src/lib/cities.ts`, `tests/cities.test.ts`
- Modify: `src/lib/catalog-shared.ts` (delete `CITIES`, `cityFromSlug`; keep `citySlug` as `slugify`), `src/lib/catalog.ts` (drop their re-exports), `src/db/seed.ts` (seed creates cities), `tests/helpers/testdb.ts` (truncate and reseed include `cities`)

**Interfaces:**
- Consumes: `cities`, `CityRow` (Task 1), `getDb`, `Tx` from `src/db/client`.
- Produces in `src/lib/cities.ts`:
  - `type City = { id: number; name: string; state?: string; slug: string; lat?: number; lng?: number }`
  - `const LAUNCH_CITIES: readonly { name: string; state: 'Rajasthan'; lat: number; lng: number }[]` (the three above; used by seed)
  - `upsertCity(tx: Tx, p: { osmType: string; osmId: number; name: string; state?: string; lat: number; lng: number }): Promise<City>` (idempotent on osm id; slug rule from Global Constraints)
  - `ensureCityByName(tx: Tx, name: string): Promise<City>` (seed and legacy use only; finds case-insensitively or creates)
  - `getCityBySlug(slug: string): Promise<City | undefined>` and `getCityByNameOrSlug(v: string): Promise<City | undefined>`
  - `listActiveCities(): Promise<City[]>` (APPROVED product or workshop; sorted by name)
  - `nearestActiveCities(from: { lat: number; lng: number }, opts?: { limit?: number; maxKm?: number }): Promise<(City & { km: number })[]>` (defaults 5 and 300; skips rows without coordinates; if none qualify returns every active city, with `km` set when coordinates are known and `-1` when not)
  - `haversineKm(a, b): number`

- [ ] **Step 1: Write failing tests** in `tests/cities.test.ts`: `upsertCity returns the same row for the same osm id`; `a second Udaipur in Tripura gets slug 'udaipur-tripura' and Rajasthan keeps 'udaipur'`; `listActiveCities omits a city whose only product is ARCHIVED`; `nearestActiveCities orders by distance, caps at 5, skips cities without coordinates`; `nearestActiveCities returns all active cities when none is within 300 km`; `haversineKm(Udaipur, Jaipur) is about 330`.
- [ ] **Step 2: Run** `npx vitest run tests/cities.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the module; haversine in plain TypeScript. Update `seed.ts` to call `ensureCityByName` for every legacy product/workshop city (using `LAUNCH_CITIES` coordinates when the name matches) and write `cityId`; add `cities` to `truncateAll`.
- [ ] **Step 4: Run** `npx vitest run tests/cities.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: cities library with active and nearest lookups"`.

### Task 3: Signed city refs and city-only place search

**Files:**
- Create: `src/lib/city-ref.ts`, `tests/city-ref.test.ts`
- Modify: `src/lib/places.ts`, `src/app/api/places/route.ts`, `tests/places.test.ts`, `tests/places-api.test.ts`

**Interfaces:**
- Consumes: `upsertCity` (Task 2).
- Produces:
  - `type CityPick = { osmType: string; osmId: number; name: string; state?: string; lat: number; lng: number }`
  - `signCityRef(p: CityPick, now?: number): string` and `verifyCityRef(ref: unknown, now?: number): CityPick` (HMAC-SHA256 with `NEXTAUTH_SECRET`; 24-hour expiry; throws `ApiError(400, 'Invalid city selection.')` on any failure; throws if the secret is unset)
  - `Place` gains optional `ref?: string`. `searchPlaces(q: string, fetchImpl?: typeof fetch, opts?: { cityOnly?: boolean }): Promise<Place[]>`: with `cityOnly`, keep only `osm_value` in city/town/village and require coordinates, and attach `ref`. Cache key includes the flag. Without it, behavior and output are unchanged (no `ref`).
  - `GET /api/places?q=...&type=city` passes `cityOnly: true`.

- [ ] **Step 1: Write failing tests**: `verifyCityRef rejects a tampered payload`, `... an expired ref`, `... a non-string`, `round-trips a valid pick`; `searchPlaces cityOnly drops localities and results without coordinates, keeps villages, and attaches a verifiable ref`; `searchPlaces without cityOnly is unchanged`; route test: `type=city` calls `searchPlaces(q, undefined, { cityOnly: true })` and the existing no-type assertions still hold.
- [ ] **Step 2: Run** `npx vitest run tests/city-ref.test.ts tests/places.test.ts tests/places-api.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Read `osm_id`, `osm_type` and `geometry.coordinates` ([lng, lat]) from Photon features; extend the local `Props` type. Use `node:crypto` `createHmac` and `timingSafeEqual`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: city-only place search with signed city refs"`.

### Task 4: Read path: types, mappers, catalog and filters

**Files:**
- Modify: `src/lib/types.ts`, `src/db/mappers.ts`, `src/lib/catalog.ts`, `src/lib/filters.ts`, `src/lib/artists.ts`, `src/lib/users.ts` (read side only), `src/app/api/products/route.ts` and the workshops list route, `src/lib/jsonld.ts`
- Modify tests: `tests/catalog.test.ts`, `tests/filters.test.ts`, `tests/artists.test.ts`, `tests/artist-profile.test.ts`, `tests/jsonld.test.ts`, `tests/helpers/testdb.ts` (`snapshot`)

**Interfaces:**
- Consumes: `City`, `getCityByNameOrSlug` (Task 2).
- Produces: `Product` and `Workshop` keep `city: string` (display name) and gain `cityId: number`, `citySlug: string`; `SellerProfile` and `Artist` keep `city?: string` and gain `cityId?: number`. `workshopsQuery(q: Q)` in `mappers.ts` mirrors `productsQuery` (joins `cities`); `productsQuery` joins `cities` (and an aliased `cities` for the artist city). `ProductFilter`/`WorkshopFilter` `city` accepts a name or slug (resolved with `getCityByNameOrSlug`; unknown yields no results, not an error). `Filters.city` in `parseFilters` is now any non-empty string up to 100 chars (no whitelist). JSON-LD `addressRegion` uses the city's state, omitted when absent.

- [ ] **Step 1: Write failing tests**: `listProducts({ city: 'udaipur' })` and `({ city: 'Udaipur' })` return the same set; `listProducts({ city: 'Nowhere' })` returns `[]` without throwing; `parseFilters({ city: 'Kota' })` returns `{ city: 'Kota' }`; `Product` from `listProducts` has `cityId` and `citySlug`; `workshopJsonLd` for a Jaipur workshop has `addressRegion: 'Rajasthan'` and omits it for a city with no state.
- [ ] **Step 2: Run** `npx vitest run tests/catalog.test.ts tests/filters.test.ts tests/jsonld.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the mapper joins and replace every `eq(...city, name)` with `eq(...cityId, resolved.id)`; add `workshopsQuery` and use it in `listWorkshops`, `getWorkshopBySlug` and wherever workshops are selected (grep `from(workshopsT)` and `from(workshops)`).
- [ ] **Step 4: Run** `npx vitest run`. Expected: only write-path and UI tests (Tasks 5 and 6) still fail.
- [ ] **Step 5: Commit** `git commit -m "feat: read cities through foreign keys"`.

### Task 5: Write path: products, workshops, seller profile

**Files:**
- Modify: `src/lib/admin.ts` (`validateProduct`, `validateWorkshop`, `PRODUCT_KEYS`, `WORKSHOP_KEYS`), `src/lib/users.ts` (`saveProfile`), `src/db/mappers.ts` (`toProductRow`, `toWorkshopRow`, `ProductInput`), `src/lib/validate.ts` (helper)
- Modify tests: `tests/admin.test.ts`, `tests/admin-api.test.ts`, `tests/admin-posts-api.test.ts`, `tests/seller-products.test.ts`, `tests/users.test.ts`, `tests/artist-profile.test.ts`

**Interfaces:**
- Consumes: `verifyCityRef`, `upsertCity`, `City`.
- Produces: `resolveCityInput(tx: Tx, raw: { cityId?: unknown; cityRef?: unknown }, opts?: { required: boolean }): Promise<number | null>` in `src/lib/cities.ts`: a numeric `cityId` must exist (else 400 "Unknown city."); a `cityRef` is verified and upserted; both absent returns `null` or 400 "city is required." when `required`. Product, workshop and profile payloads take `cityId` or `cityRef` instead of `city`. Validation currently done outside transactions that needs a `Tx` moves inside the existing transaction.

- [ ] **Step 1: Write failing tests**: `creating a product with a valid cityRef for Kota creates the city and links it`; `... with a tampered cityRef returns 400 and creates no city`; `... with a free-text city string returns 400`; `... with cityId of an existing city links it`; `workshops behave the same`; `saveProfile with cityRef sets the artist city, with neither clears it`; `editing a product without changing city keeps its cityId`.
- [ ] **Step 2: Run** `npx vitest run tests/admin.test.ts tests/users.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `resolveCityInput` and wire it into the three write paths; keep the "unchanged content" comparison (`contentOf`) working with `cityId`.
- [ ] **Step 4: Run** the related test files. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: accept only validated cities on write"`.

### Task 6: City search UI and listing surfaces

**Files:**
- Create: `src/components/CityInput.tsx`, `tests/city-input.test.tsx`
- Modify: `src/components/PostForm.tsx`, `src/components/ProfileDialog.tsx`, `src/components/LiveCatalog.tsx`, `src/components/Footer.tsx`, `src/app/page.tsx`, `src/app/cities/[city]/page.tsx`, `src/app/sitemap.ts`, `src/app/shop/page.tsx`, `src/app/workshops/page.tsx`, `src/lib/site.ts`
- Modify tests: `tests/post-form.test.ts`, `tests/forms-required.test.tsx`, `tests/live-catalog.test.tsx`, `tests/home-explorer.test.tsx`, `tests/trending-pages.test.tsx`, `tests/meta.test.ts`

**Interfaces:**
- Consumes: `/api/places?type=city` (Task 3), `listActiveCities`, `getCityBySlug` (Task 2), write payload shape (Task 5).
- Produces: `CityInput({ name?: 'city'; defaultCity?: { id: number; label: string }; required?: boolean }): JSX.Element`, a client component with the same type-ahead behavior as `PlaceInput` but selection-only: typed text alone never validates; selecting a result writes hidden `cityRef` (or hidden `cityId` for the untouched default). On search error it shows "City search is unavailable. Your current city is kept." and keeps the previous value. `LiveCatalog` receives `cities: { name: string; slug: string }[]` as a prop for its filter dropdown. City page returns `notFound()` unless the city is in `listActiveCities()`. Footer, home link row and sitemap use `listActiveCities()`. `SITE.description`, shop and workshop page copy stop naming the three cities (neutral wording; final wording is part 3).

- [ ] **Step 1: Write failing tests**: `CityInput submits cityRef only after a suggestion is chosen`; `typing without choosing leaves the form invalid`; `a failed search keeps the previous city and shows the message`; `PostForm and ProfileDialog use CityInput`; `LiveCatalog lists the cities it is given`; `the city page for a city with only archived products calls notFound`; `sitemap lists only active cities`.
- [ ] **Step 2: Run** `npx vitest run tests/city-input.test.tsx tests/live-catalog.test.tsx tests/post-form.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `CityInput` (reuse `PlaceInput`'s debounce and keyboard handling by extracting a shared hook if the duplication is large) and update the listed files. Pages that read dynamic data stay `force-dynamic`; `generateStaticParams` for the city page is removed.
- [ ] **Step 4: Run** `npx vitest run`. Expected: all PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: city search inputs and data-driven city listings"`.

### Task 7: Nearby cities empty state

**Files:**
- Create: `src/components/NearbyCities.tsx`, `tests/nearby-cities.test.tsx`

**Interfaces:**
- Consumes: `nearestActiveCities`, `City` (Task 2).
- Produces: `NearbyCities({ cityName: string; cities: (City & { km: number })[] }): JSX.Element` renders "Right now we don't have anything for you to shop at, but you can still explore nearby cities' shops and workshops." followed by links to `/cities/<slug>` with distance; with an empty `cities` array it renders the message only. Not wired to any page in this part (part 2 does).

- [ ] **Step 1: Write failing tests**: `renders the message and one link per city with its distance`; `renders only the message when there are no cities`; `omits the distance when km is -1`.
- [ ] **Step 2: Run** `npx vitest run tests/nearby-cities.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the component with existing design tokens.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all PASS, no type errors.
- [ ] **Step 5: Update docs and commit**: note the new place-search `type=city` option and city model in `README.md`; `git commit -m "feat: nearby cities empty state component"`.
