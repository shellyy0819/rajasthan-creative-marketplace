# Workshop Listings (online classes, topics, price rows, admin listings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an online instructor (first: a yoga teacher) submit and be listed with schedule, price plans, languages and contact details, let admins add and edit listings on behalf of hosts, and keep in-person events working unchanged.

**Architecture:** Extend `workshops` and `workshop_requests` with mode/kind/topic/online fields, add `workshop_prices` and `workshop_topics`, share one validation module between the public request API and the admin API, branch the existing 3-step host form on a step-1 choice (In-person event / Online class), and add an admin listings page that reuses that form in admin mode. Ended listings leave lists and the sitemap and their page becomes noindex.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before touching routes), Drizzle ORM + Postgres (PGlite in tests), Vitest + Testing Library, plain CSS per feature file.

**Spec:** `docs/superpowers/specs/2026-11-18-workshop-listings-design.md` (binding; this plan argues from it).

## Global Constraints

- Run Vitest on Node 22: `PATH=$HOME/.nvm/versions/node/v22.22.2/bin:$PATH`; DB-backed tests under load: `--maxWorkers=3 --hookTimeout=60000`. `npx tsc --noEmit` must pass.
- New or changed CSS goes in per-feature files (e.g. `src/components/WorkshopListings.css`), no new colours: use tokens from `globals.css`; no literal font names (`tests/typography.test.ts`).
- Branch: `feat/workshop-listings` (stacked on `feat/host-workshop-link`, PR #73). One migration per task that needs one, numbered after `0025_city_requests` (use the next free number at merge: `feat/category-pages` also adds 0026). Never run a migration against the production database; local only (`.env.local`, localhost:5434).
- Public pages and APIs never expose: `contact_name`, `contact_phone`, `contact_email`, `created_by`, `source_request_id`.
- `status` values stay `DRAFT | APPROVED | ARCHIVED`; the UI labels them Draft / Published / Archived. Only `APPROVED` and current listings are public.
- Online classes are contact-only: no `ReserveButton`, no seats. The join link is never stored.
- Time zone for "current vs ended" is Asia/Kolkata (`istParts`, `istToDate` in `src/db/mappers.ts`).
- Commit messages plain, no attribution lines (project memory).
- Limits (spec): `languages` up to 5 entries of 2 to 30 characters; `experience`, `certifications` up to 500; `platform` up to 60; price rows up to 5, `label` up to 30, `amount_paise >= 0`; `kind` in workshop|meetup|popup|market|class; `mode` in in_person|online|hybrid; `level` in beginner|intermediate|advanced|all; schedule `days` subset of mon..sun, `time` HH:MM, `durationMin` 15 to 480.

## Shipping slices (each is its own PR, in order)

1. Tasks 1 to 3: foundation (migration, shared rules, mappers, admin API).
2. Tasks 4 to 6: public path (requests, two-path form, public display and SEO).
3. Tasks 7 to 8: admin screens (listings page, create from request, topics list).

## Review Focus

1. An online listing with no city/venue must not vanish or crash: `/workshops`, home, sitemap, JSON-LD, OG image, detail page, city pages (excluded there) and the admin table.
2. "Ended" boundaries: one-off at 23:59 IST vs 00:01 IST next day; multi-day event uses `ends_on`; class with `ends_on = null` never ends; ended page returns 200 with noindex, not 404.
3. Price rows: no rows or all-zero rows give type FREE and `price_paise` 0; a mix of a 0 row and paid rows gives PAID and `price_paise` = the lowest amount above 0 (never 0 on a PAID listing); the free-trial flag never changes price.
4. `POST /api/workshops` default status flips to DRAFT: every existing caller and test that expects a public workshop must pass `status: 'APPROVED'`.
5. Admin-only contact fields must not appear in any public response (`/api/workshops`, `/api/workshops/[id]` for non-admins, page HTML, JSON-LD).

---

### Task 1: Schema, migration and topic seed

**Files:**
- Modify: `src/db/schema.ts` (workshops 138-164, workshop_requests 253-293; new `workshopPrices`, `workshopTopics`)
- Create: `drizzle/0026_workshop_listings.sql` (+ journal/snapshot via `npm run db:generate`, then hand-edit)
- Test: `tests/workshop-listings-schema.test.ts`

**Interfaces:**
- Produces: tables `workshop_topics(id serial, slug text unique, name text, parent_id int null fk self, position int, active bool default true)` with unique index on `lower(name)`; `workshop_prices(id serial, workshop_id text fk cascade, label text, amount_paise int check >= 0, sessions int null, position int)`; new `workshops` columns exactly as spec section 1; new `workshop_requests` columns: `mode`, `topic_id`, `platform`, `schedule` jsonb, `ends_on` date, `languages` text[], `level`, `experience`, `certifications`, `free_trial`, `whatsapp`, `prices` jsonb default `'[]'`, `listed_workshop_id` text null; `city`, `venue` nullable; `status` check adds `'listed'`; `kind` check adds `'class'`.
- Produces (TS): exported Drizzle tables `workshopPrices`, `workshopTopics`; existing `workshops`/`workshopRequests` tables with the new columns.

- [ ] **Step 1: Write failing tests** in `tests/workshop-listings-schema.test.ts` (use `resetTestDb`): (a) an old-shape workshop row (in person, city, venue, seats) still inserts and defaults `mode='in_person'`, `kind='workshop'`, `languages=[]`, `images=[]`, `free_trial=false`; (b) inserting `mode='online'` with null `city_id`, `venue`, `seats` succeeds; `mode='in_person'` with null `city_id` is rejected by the check; (c) `workshop_prices` row with negative amount rejected, deleting the workshop deletes its prices; (d) `workshop_topics` seeded with `Yoga` and `Crochet`, duplicate name differing only by case rejected; (e) a request with `kind='class'`, `mode='online'`, null city/venue inserts; (f) every existing fixture workshop (`resetTestDb()`) has `mode='in_person'`.
- [ ] **Step 2: Run** `npx vitest run tests/workshop-listings-schema.test.ts` Expected: FAIL (columns missing).
- [ ] **Step 3: Implement** the schema changes in `schema.ts`; run `npm run db:generate` (local), then edit the SQL so it: adds columns with defaults, relaxes NOT NULLs, adds checks `workshops_mode_valid`, `workshops_kind_valid`, `workshops_level_valid`, `workshops_place_by_mode` (`mode = 'online' OR (city_id IS NOT NULL AND venue IS NOT NULL)`), replaces `workshops_seats_positive` and `workshops_booked_range` to allow null seats, adds both new tables, inserts the Yoga and Crochet topics with slugs `yoga`, `crochet`, and updates the request check constraints.
- [ ] **Step 4: Run** the new test file plus `npx vitest run tests/db-schema.test.ts --maxWorkers=3 --hookTimeout=60000`. Expected: PASS.
- [ ] **Step 5: Commit** `git add drizzle src/db/schema.ts tests/workshop-listings-schema.test.ts && git commit -m "feat: schema for online classes, topics and price rows"`.

### Task 2: Shared listing rules (validation, schedule, current/ended)

**Files:**
- Create: `src/lib/workshop-listing.ts`
- Test: `tests/workshop-listing.test.ts`

**Interfaces:**
- Consumes: `text`, `int`, `optionalText`, `oneOf`, `validDate`, `bad`, `Raw` from `src/lib/validate.ts`; `istParts` from `src/db/mappers.ts`.
- Produces:
  - `export const KINDS = ['workshop','meetup','popup','market','class'] as const; MODES; LEVELS; DAYS` and types `Kind`, `Mode`, `Level`, `Day`.
  - `export type Schedule = { days: Day[]; time: string; durationMin: number }`
  - `export type PriceRow = { label: string; amountPaise: number; sessions: number | null }`
  - `export type ListingFields = { kind: Kind; mode: Mode; topicId: number | null; platform: string | null; schedule: Schedule | null; endsOn: string | null; languages: string[]; level: Level | null; experience: string | null; certifications: string | null; freeTrial: boolean; whatsapp: string | null; instagram: string | null; website: string | null; prices: PriceRow[] }`
  - `export function parseListingFields(raw: Raw): ListingFields` throws `bad(...)` on any violation (limits in Global Constraints; `whatsapp` uses `optionalPhone`; online mode requires `platform` and a `schedule`; `kind='class'` implies `mode` online or hybrid).
  - `export function priceCache(rows: PriceRow[]): { type: 'FREE' | 'PAID'; pricePaise: number }` (no rows or all rows zero: FREE/0; else PAID and the lowest amount above 0).
  - `export function lastDay(w: { date: string; endsOn?: string | null; kind: string }): string | null` (YYYY-MM-DD, `null` = open-ended class).
  - `export function isCurrent(w: Parameters<typeof lastDay>[0], now?: Date): boolean` (true when `lastDay` is null or `>=` today's IST date).
  - `export function describeSchedule(s: Schedule): string` e.g. `Mon, Wed, Fri at 7:00 am, 60 min`.
  - `export function summarizePrices(rows: PriceRow[]): { from: string; all: string[] }` (uses `money` from `src/lib/money.ts`).

- [ ] **Step 1: Write failing tests** in `tests/workshop-listing.test.ts`: `parseListingFields` rejects: 6 languages, a 1-character language, level `expert`, online without platform, online without schedule, schedule day `xyz`, duration 10, 6 price rows, negative amount, `kind` `class` with `mode` `in_person`; accepts a full yoga payload and returns normalized values (languages trimmed, whatsapp as canonical `+91` number). `priceCache([])` and `priceCache([{amountPaise:0..}])` give FREE/0; `priceCache` of rows 500_00 and 1500_00 gives PAID/50000, and of rows 0 and 500_00 gives PAID/50000. `isCurrent` with `now` fixed: one-off dated today IST at 23:59 is current; dated yesterday is not; multi-day with `endsOn` tomorrow is current; class with `endsOn` null is always current. `describeSchedule` gives the exact string above.
- [ ] **Step 2: Run** the file. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the module (pure functions; reuse validate helpers; no DB access).
- [ ] **Step 4: Run** the file. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: shared rules for workshop listings (validation, price cache, current vs ended)"`.

### Task 3: Domain type, mappers, admin API, catalog queries

**Files:**
- Modify: `src/lib/types.ts` (Workshop), `src/db/mappers.ts` (workshopsQuery 119-137), `src/lib/admin.ts` (validateWorkshop 183, createWorkshop, updateWorkshop, WORKSHOP_KEYS), `src/lib/catalog.ts` (listWorkshops 83-95, getWorkshopBySlug 106-112), `src/lib/filters.ts`, `src/app/api/workshops/route.ts`, `src/app/api/workshops/[id]/route.ts`
- Modify (existing tests, set `status: 'APPROVED'` where they create workshops): `tests/admin.test.ts`, `tests/admin-api.test.ts`, `tests/users-api.test.ts`, `tests/users.test.ts`, `tests/seller-products.test.ts`, `tests/pg-concurrency.test.ts`
- Test: `tests/workshop-listings-admin.test.ts`

**Interfaces:**
- Consumes: Task 1 tables; Task 2 `parseListingFields`, `priceCache`, `isCurrent`, `ListingFields`, `PriceRow`.
- Produces:
  - `Workshop` type: `cityId: number | null; city: string | null; citySlug: string | null; venue: string | null; seats: number | null` plus `kind, mode, topicId, topic?: { id; name; slug }, platform, schedule, endsOn, languages, level, experience, certifications, freeTrial, whatsapp, instagram, website, images, prices: PriceRow[]`. Admin variant adds `contactName, contactPhone, contactEmail, createdBy, sourceRequestId`.
  - `workshopsQuery` uses `leftJoin(cities, ...)`; add `loadPrices(q, ids): Map<string, PriceRow[]>` and use it in `listWorkshops`/`getWorkshopBySlug`/`loadWorkshop`.
  - `createWorkshop(input: unknown, adminId?: string): Promise<Workshop>`: `status` accepted, default `'DRAFT'`; accepts all listing fields and `prices`; writes price rows and `priceCache` into `type`/`price_paise`; requires city+venue+seats unless `mode='online'`.
  - `updateWorkshop(id, input)`: same rules; replaces price rows when `prices` is present.
  - `listWorkshops(f: Filters)`: returns only `APPROVED` and `isCurrent` listings; `Filters` gains `mode?: 'in_person' | 'online'` parsed from `?mode=`; add `listCurrentWorkshopSlugs` not needed (reuse `listWorkshops()`); add `getWorkshopBySlug(slug)` returning `{ workshop, ended: boolean } | null` (ended listings still resolve; DRAFT/ARCHIVED still `null`).
  - `listAdminWorkshops(): Promise<Workshop[]>` (all statuses, newest first, admin variant).

- [ ] **Step 1: Write failing tests** in `tests/workshop-listings-admin.test.ts`: (a) `createWorkshop` with a yoga online payload (no city/venue/seats, 3 price rows, languages `['Hindi','English']`) returns status `DRAFT`, `mode` `online`, `type` `PAID`, `pricePaise` the lowest row, prices ordered; (b) default is DRAFT and a DRAFT is absent from `listWorkshops()` while `status:'APPROVED'` appears; (c) `listWorkshops` omits a listing whose date is yesterday IST and keeps an open-ended class; `listWorkshops({ mode: 'online' })` returns only online; (d) `getWorkshopBySlug` returns `ended: true` for yesterday's APPROVED listing, `null` for DRAFT; (e) in-person payload without city is rejected with `city is required.`; (f) `updateWorkshop` replacing `prices` deletes the old rows; seats below `booked` still rejected; (g) public `/api/workshops` JSON and `toWorkshop` never contain `contactPhone`, `contactEmail`, `createdBy`; admin `GET` of the workshop does; (h) existing fixture workshops still list (they are APPROVED, in the past relative to today: change the fixture dates only if `isCurrent` hides them: set fixture `date` values to dates far in the future in `tests/fixtures/db.json` and update the three date assertions in `tests/db-schema.test.ts`/`tests/catalog.test.ts` accordingly).
- [ ] **Step 2: Run** the new file. Expected: FAIL.
- [ ] **Step 3: Implement** mappers, types, admin functions, catalog, routes. `POST /api/workshops` passes the admin's id as `createdBy`. Keep `ReserveButton` and `createBooking` unchanged, but `createBooking` rejects a workshop whose `kind='class'` or whose last day has passed (409 `This event has ended.` / `Bookings are not open for classes.`).
- [ ] **Step 4: Update** the six existing test files to pass `status: 'APPROVED'` on workshop creation; run `npx vitest run tests/workshop-listings-admin.test.ts tests/admin.test.ts tests/admin-api.test.ts tests/users-api.test.ts tests/users.test.ts tests/seller-products.test.ts tests/catalog.test.ts tests/orders.test.ts tests/db-schema.test.ts tests/cities.test.ts tests/city-links.test.tsx tests/jsonld.test.ts --maxWorkers=3 --hookTimeout=60000` and `npx tsc --noEmit`. Expected: PASS, tsc clean. Fix every consumer of the now-nullable `city`, `venue`, `seats` that tsc reports (cards, detail page, OG image, JSON-LD, city pages) with minimal null handling; their presentation changes are Task 6.
- [ ] **Step 5: Commit** `git commit -m "feat: online classes, price rows and draft/published status in the workshop domain and admin API"`.

### Task 4: Workshop requests accept the online path

**Files:**
- Modify: `src/lib/workshop-requests.ts` (`createWorkshopRequest`, `toRequest`, `REQUEST_KINDS`), `src/lib/workshop-notify.ts` (`notificationMail`), `src/components/WorkshopRequestsAdmin.tsx`, `src/lib/workshop-requests-shared.ts` (types)
- Test: `tests/workshop-requests.test.ts` (extend), `tests/workshop-requests-online.test.ts`

**Interfaces:**
- Consumes: Task 2 `parseListingFields`, `priceCache`; Task 1 request columns.
- Produces: `createWorkshopRequest(input)` accepts `mode` (`in_person` default | `online`), `topicId`, and the listing fields; for `mode='online'`: city/venue/seats ignored and stored null, `schedule` required, `startDate` required, price from `prices` (stored in `prices` jsonb and `priceType`/`pricePaise` via `priceCache`); for in-person: behaviour exactly as before. `WorkshopRequest` type gains the new fields; `notificationMail` lists them (mode, topic name, platform, schedule via `describeSchedule`, prices, languages, level, experience, certifications, free trial, WhatsApp); `WorkshopRequestsAdmin` shows the same under the Event and Where/When columns.

- [ ] **Step 1: Write failing tests** in `tests/workshop-requests-online.test.ts`: a yoga online request (no city/venue, 3 price rows, languages, level, WhatsApp, topicId of Yoga) is stored with `mode='online'`, null `city`/`venue`, `kind='class'`, `price_type='PAID'`; an online request that also sends a venue ignores it; an in-person request without `cityRef` is still rejected; online without `schedule` rejected; `notificationMail` text contains `Mon, Wed, Fri at 7:00 am`, `Per session` and the WhatsApp number; all existing tests in `tests/workshop-requests.test.ts` still pass unchanged.
- [ ] **Step 2: Run** both files. Expected: FAIL for the new file.
- [ ] **Step 3: Implement.** Reuse the code-email flow unchanged.
- [ ] **Step 4: Run** `npx vitest run tests/workshop-requests.test.ts tests/workshop-requests-online.test.ts tests/request-received.test.tsx tests/requests-overview.test.tsx --maxWorkers=3 --hookTimeout=60000`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: workshop requests accept online classes"`.

### Task 5: Two-path host form

**Files:**
- Modify: `src/components/HostWorkshopButton.tsx`, `src/lib/host-link.ts`, `src/app/workshops/page.tsx`, `src/components/WorkshopsEmptyState.tsx`, `src/components/Footer.tsx`
- Create: `src/components/HostListingFields.tsx` (field groups per path, shared with Task 7), `src/components/WorkshopListings.css`
- Test: `tests/host-workshop-paths.test.tsx` (extend the existing `tests/host-workshop-stepper.test.tsx` expectations where step 1 changes)

**Interfaces:**
- Consumes: Task 4 API contract; topics list passed as props from the server page: `topics: { id: number; name: string }[]` (new `listActiveTopics()` in `src/lib/topics.ts`).
- Produces: `HostWorkshopButton({ className?, contactEmail?, defaultOpen?, shareable?, defaultPath?: 'event' | 'class', topics?: Topic[], label? })`; `host-link.ts` exports `hostPath(sp): 'event' | 'class' | null` (`?host=class` gives `'class'`, `?host=1` gives `null`). Step 1 shows "What are you hosting?" as two radio cards (In-person event, Online class), Topic select (`Other` option), then title/description/photos (+ Type select only for in-person). Step 2/3 content follows the spec (section 4). `HostListingFields` exports `EventWhereWhen`, `ClassWhenAndPrice`, `ClassAbout` field groups that read/write named inputs (price rows as `prices` built on submit).

- [ ] **Step 1: Write failing tests** in `tests/host-workshop-paths.test.tsx`: step 1 shows the two choices and Next is blocked until one is chosen when opened with `?host=1`; `defaultPath='class'` starts with Online class selected and no Type select; choosing Online class makes step 2 show Platform, class-day chips, Time, Duration and a price editor and hide City/Venue/Seats; choosing In-person keeps the existing step 2; switching the choice at step 1 keeps title/description; the price editor adds up to 5 rows and removes rows; the submitted body for a yoga path contains `mode:'online'`, `kind:'class'`, `schedule:{days,time,durationMin}`, `prices:[{label,amountPaise,sessions}]`, `languages` array, `level`, `whatsapp`, `topicId`; the in-person submitted body equals today's (existing stepper test passes). `hostPath({host:'class'})` is `'class'`, `{host:'1'}` is `null`, `{}` is `null`. Footer link text unchanged; the empty state shows a second button "Teach an online class".
- [ ] **Step 2: Run** `npx vitest run tests/host-workshop-paths.test.tsx tests/host-workshop-stepper.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** (client-side validation mirrors Task 2 limits via `stepValid`; the form still uses one `<form>`, hidden steps stay mounted). Add `?host=class` handling in `src/app/workshops/page.tsx` (noindex rule already covers `host`).
- [ ] **Step 4: Run** the two test files plus `tests/host-workshop-link.test.tsx tests/host-workshop-ssr.test.tsx tests/empty-list-pages.test.tsx tests/footer-links.test.tsx tests/typography.test.ts`; check the form in a browser at 1280px and 390px, both paths. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: host form has an in-person event path and an online class path"`.

### Task 6: Public display, SEO and "what we support" copy

**Files:**
- Modify: `src/components/WorkshopCard.tsx`, `src/app/workshops/[slug]/page.tsx`, `src/app/workshops/[slug]/opengraph-image.tsx`, `src/lib/jsonld.ts` (`workshopJsonLd`), `src/components/LiveCatalog.tsx` (mode filter), `src/app/sitemap.ts`, `src/app/workshops/page.tsx`, `src/components/WorkshopsEmptyState.tsx`, `src/components/HostWorkshopButton.tsx` (intro line), `src/app/cities/[city]/page.tsx`
- Create: `src/lib/workshop-support.ts`
- Test: `tests/workshop-public.test.tsx`, `tests/workshop-support.test.ts`

**Interfaces:**
- Consumes: Task 3 `getWorkshopBySlug` (`{ workshop, ended }`), `listWorkshops` (current only), Task 2 `describeSchedule`, `summarizePrices`.
- Produces: `SUPPORTED_LISTINGS: { label: string; kind: Kind; mode: Mode }[]` (In-person workshops, meetups, pop-ups, flea markets; Online classes) and `supportLine(): string` ("List a workshop, meetup, pop-up, flea market or online class."), used by the `/workshops` header sub-line, the empty-state card and the host form intro.

- [ ] **Step 1: Write failing tests:** `workshop-support.test.ts`: every `SUPPORTED_LISTINGS` entry has a matching option in the form (render `HostWorkshopButton` open; Type options and the Online class choice cover each); `supportLine()` mentions each label. `workshop-public.test.tsx`: card for an online class shows `Online`, the platform, level, `Free trial` badge, price "From Rs. 500", contact buttons (WhatsApp `https://wa.me/91...`, Instagram) and no Reserve button; in-person card unchanged; detail page lists every price row and the schedule text; ended listing detail page returns content with "This event has ended" and robots `noindex, follow`, current one has no robots; `generateMetadata` for a DRAFT slug calls not-found; JSON-LD for online has `eventAttendanceMode` `https://schema.org/OnlineEventAttendanceMode` and `location` `VirtualLocation`, no `PostalAddress`, with `offers` per price row; in-person JSON-LD unchanged; sitemap omits ended and DRAFT listings and includes an open-ended class; city page omits online listings; `/workshops?mode=online` lists only online; when all listings ended, `/workshops` metadata is noindex and shows the empty state.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement.** Contact buttons reuse `whatsappUrl` and `instagramUrl` from `src/lib/social.ts` (no new link builders; no prefilled text). Styles in `WorkshopListings.css`.
- [ ] **Step 4: Run** `npx vitest run tests/workshop-public.test.tsx tests/workshop-support.test.ts tests/jsonld.test.ts tests/live-catalog.test.tsx tests/trending-pages.test.tsx tests/empty-list-pages.test.tsx tests/city-links.test.tsx --maxWorkers=3 --hookTimeout=60000`; screenshot the card and detail page for an online class and an ended event. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: online class cards and pages, ended listings leave lists and sitemap, supported listing types stated"`.

### Task 7: Admin listings page and create from request

**Files:**
- Create: `src/app/dashboard/workshops/page.tsx`, `src/components/WorkshopsAdmin.tsx`, `src/components/ListingForm.tsx` (the stepper in admin mode, reusing `HostListingFields`), `src/app/api/workshops/[id]/status/route.ts` (PATCH `{ status }`)
- Modify: `src/components/AdminTabs.tsx`, `src/components/WorkshopRequestsAdmin.tsx` ("Create listing"), `src/lib/workshop-requests.ts` (`markRequestListed`), `src/app/api/workshops/route.ts` (accepts `sourceRequestId`)
- Test: `tests/workshops-admin.test.tsx`, `tests/workshops-admin-api.test.ts`

**Interfaces:**
- Consumes: Task 3 `createWorkshop`, `updateWorkshop`, `listAdminWorkshops`; Task 5 `HostListingFields`; Task 4 request type.
- Produces: `ListingForm({ initial?: Partial<AdminListingValues>; fromRequest?: WorkshopRequest; onSaved(w: Workshop): void })` with a Status select (Draft default, Published, Archived), host user link (optional), private contact fields, same limits; `PATCH /api/workshops/[id]/status` (`requireAdmin`, `oneOf(['DRAFT','APPROVED','ARCHIVED'])`, revalidates layout); `markRequestListed(requestId: string, workshopId: string): Promise<void>` sets request `status='listed'`, `listed_workshop_id`. Creating with `sourceRequestId` calls it in the same transaction.

- [ ] **Step 1: Write failing tests:** `workshops-admin-api.test.ts`: non-admin gets 401/403 on create, patch, status; admin create with `sourceRequestId` marks the request `listed` and stores `source_request_id`; status route moves DRAFT to APPROVED and the listing then appears in `listWorkshops()`; invalid status 400. `workshops-admin.test.tsx`: the table shows title, host, mode, topic, dates, a status select defaulting to the stored value; New listing opens the form with Status = Draft; "Create listing" on a request opens the form pre-filled (title, description, host, contact, prices) and saving posts `sourceRequestId`; the form has no email-code step and no honeypot; saving a Published listing shows it in the table.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement** (all pages call `requireAdminPage`; follow `WorkshopRequestsAdmin` and `SourcingTypesAdmin` structure; edit and archive through the same form and status select).
- [ ] **Step 4: Run** the two files plus `tests/requests-overview.test.tsx tests/admin-api.test.ts`; check the page in a browser (list, new online class as Draft, publish, public page appears). Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: admin can add, edit, publish and archive workshop listings on behalf of hosts"`.

### Task 8: Topics list in the dashboard

**Files:**
- Create: `src/app/dashboard/workshop-topics/page.tsx`, `src/components/TopicsAdmin.tsx`, `src/app/api/workshop-topics/route.ts`, `src/lib/topics.ts` (`listActiveTopics`, `listTopics`, `createTopic`, `setTopicActive`)
- Modify: `src/components/AdminTabs.tsx`
- Test: `tests/topics-admin.test.ts`

**Interfaces:**
- Consumes: Task 1 `workshopTopics`. Produces: `createTopic(input: unknown): Promise<Topic>` (name 2 to 40 characters using `checkCategoryName` from `src/lib/category-name.ts`, slug generated in code as lower-case kebab with `-2` suffix on clash, `parent_id` optional but no UI yet), `setTopicActive(id: number, active: boolean)`, `Topic = { id: number; slug: string; name: string; parentId: number | null; active: boolean }`.

- [ ] **Step 1: Write failing tests:** create "Prenatal Yoga" gives slug `prenatal-yoga`; a second "prenatal yoga" (case) is rejected; "Yoga & Wellness" gives `yoga-and-wellness`; inactive topics are absent from `listActiveTopics`; routes are admin-only; a listing whose topic is deactivated still shows its topic name.
- [ ] **Step 2: Run** `npx vitest run tests/topics-admin.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** following `SourcingTypesAdmin`.
- [ ] **Step 4: Run** the file and the full suite: `npx vitest run --maxWorkers=3 --hookTimeout=60000` and `npx tsc --noEmit`. Expected: PASS except the known pre-existing failures (fair-game, fair-page, seller-onboarding-step2, trending-pages "Explore by city", value-props); list any other failure by name.
- [ ] **Step 5: Commit** `git commit -m "feat: dashboard list of workshop topics"`.
