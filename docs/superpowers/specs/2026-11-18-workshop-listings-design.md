# Workshop listings: online classes, topics, structured pricing

Status: draft for approval. Date: 2026-11-18. Approach "A" was chosen in conversation (four layers: listing, topic, format and schedule, pricing rows).

## Intent

An online yoga instructor will give us: name and intro, styles and class descriptions, experience and certifications, class days/times/duration, platform (Zoom, Meet), batches and levels, pricing per session/month/quarter, free trial, languages, photos or posters, Instagram/website/WhatsApp, and special offers. Prenatal yoga comes later. Today a listing is one dated, in-person event with a venue and one price, so most of this has nowhere to go.

Goal: a listing model that fits online recurring classes now and new topics (prenatal yoga, others) later without a new column or a new table per topic.

## Goals, non-goals, anti-goals

Goals
- An instructor can submit everything above through the host form and see it on a public listing.
- In-person events keep working exactly as today (same URLs, slugs, booking).
- `/workshops` says plainly what can be listed, and that text never promises more than the form accepts.
- Adding a topic is a data change (a row), not a code change. Topic-specific questions (prenatal) are phase 2.

Non-goals (phase 1)
- No per-date session table, per-session booking or payments for classes. Online classes are contact-first (WhatsApp / Instagram), as the product page already works.
- No topic hierarchy screens, topic pages, language filter or topic filter.
- No generic form builder.

Anti-goals
- A page or form that says we support something it cannot take.
- Breaking existing workshop URLs, slugs, bookings or JSON-LD for in-person events.

## Current state (checked in the code, 2026-11-18)

- `workshops` (src/db/schema.ts:138): `type` FREE/PAID, single `price_paise`, `city_id` and `venue` required, single `starts_at`, `seats` required with a `booked` counter. No images, mode, language, level or contact columns.
- `workshop_requests` (schema.ts:253): has `kind` (workshop/meetup/popup/market), start/end date, optional times, one price, images, Instagram, website. `kind` is never copied to `workshops`. There is no link from a request to a listing.
- There is no admin screen that creates or approves a workshop. Admin only views requests (`WorkshopRequestsAdmin`), then creates a listing through the admin JSON API (`POST /api/workshops`). `createWorkshop` has no other caller.
- There is no upcoming/past logic: `listWorkshops` filters status, city, type and search, and orders by id. A past workshop stays listed, in the sitemap and bookable.
- `workshopsQuery` inner-joins `cities`, so a listing without a city would disappear.
- Booking (`createBooking`) is a seat counter, free or demo-priced, no emails, no payment.
- WhatsApp exists only on `seller_profiles`; the product page builds `wa.me` links from it (`MakerCard`, `social.ts`).
- Product categories (name FK, 100 cap, inline create) have slugs and pages only on `feat/category-pages` (PR #71, not merged).

## Approaches considered

- A (chosen): structured layers. Columns for what people filter or sort on, a `workshop_prices` table, a `workshop_topics` table, `details` JSON for topic extras (phase 2).
- B: one JSON column for everything new. Fastest, but languages, level and price become unsearchable and unvalidated.
- C: a separate "Classes" entity. Cleanest model, but two listings, two forms and two sets of pages to keep.

## Design

### 1. Data model (one migration)

`workshops` gains:
- `kind` text not null default 'workshop', check in (workshop, meetup, popup, market, class).
- `mode` text not null default 'in_person', check in (in_person, online, hybrid).
- `city_id` and `venue` become nullable, with a check that both are present unless `mode = 'online'`.
- `seats` becomes nullable (check null or >= 1); `booked` check allows null seats. Classes have no seat counter.
- `topic_id` integer null, FK `workshop_topics.id`.
- `platform` text null (Zoom, Google Meet, Other: free text up to 60).
- `schedule` jsonb null: `{ days: ['mon', ...], time: 'HH:MM', durationMin: number }` for weekly classes.
- `ends_on` date null: last date of an ongoing class; null means open-ended.
- `languages` text[] not null default '{}' (up to 5 entries, 2 to 30 characters each).
- `level` text null, check in (beginner, intermediate, advanced, all).
- `experience` text null (up to 500), `certifications` text null (up to 500).
- `free_trial` boolean not null default false.
- `whatsapp`, `instagram`, `website` text null.
- `images` jsonb not null default '[]' (today listings have no images; requests do).

New `workshop_prices`: `id` serial, `workshop_id` text FK on delete cascade, `label` text (up to 30; presets Per session, Monthly, Quarterly, or custom), `amount_paise` integer >= 0, `sessions` integer null, `position` integer. At most 5 per listing.
- `workshops.price_paise` and `type` stay. They are a cache the app sets from the rows: `price_paise` = lowest row, `type` = FREE when every row is 0 or there are no rows. Existing filters, cards, JSON-LD and booking keep reading them.

New `workshop_topics`: `id` serial, `slug` text unique, `name` text unique (case-insensitive), `parent_id` integer null FK self, `position` integer, `active` boolean default true. Seeded with "Yoga" and "Crochet" (my call: the two we know). `parent_id` exists now so prenatal yoga is a child row later; no screen uses it in phase 1. Managed in the dashboard as a plain list, like sourcing types.

`workshop_requests` gains the same fields as `workshops` (mode, kind 'class', topic_id, platform, schedule, ends_on, languages, level, experience, certifications, free_trial, whatsapp) plus `prices` jsonb `[{label, amountPaise, sessions}]`. `city` and `venue` become nullable for online. Existing rows are unchanged.

Backfill: every existing `workshops` row gets mode 'in_person', kind 'workshop', topic null, empty arrays. Booking and seat code is untouched.

### 2. Request to listing

Finding: nothing turns a request into a listing. Phase 1 adds an "Approve and list" action on each request in the dashboard. It creates the `workshops` row (status APPROVED) and its price rows from the request, stores the new workshop id on the request, and marks the request `listed`. There is still no listing editor: changes go through the existing admin API. (This is open question 1.)

### 3. Public pages

- `workshopsQuery` becomes a left join on `cities`. City pages still list only listings with a city; online ones appear on `/workshops` and the home page.
- Card and detail page show: an "Online" badge with the platform, level, languages, the schedule as text ("Mon, Wed, Fri at 7:00 am, 60 min"), price rows ("From Rs. 500" on the card, every row on the detail page), a "Free trial" badge, and contact buttons (WhatsApp via `wa.me`, Instagram, website) using the existing link helpers.
- Classes (`kind = 'class'`) show contact buttons instead of `ReserveButton`. In-person events keep Reserve.
- JSON-LD: online listings use `OnlineEventAttendanceMode` with a `VirtualLocation` (the listing page URL; the join link is never stored or shown). In-person listings are unchanged. Weekly classes add `eventSchedule`; price rows become `offers`.
- A mode filter (All / In person / Online) next to the existing Free and paid filter.
- "Upcoming": the list shows a listing while its last date is today or later (one-off: `starts_at`; class: `ends_on`, or always when open-ended). Past ones stay in the database, their page still opens with an "Ended" note and noindex, and they leave the sitemap and the list. (This changes today's behavior, open question 2.)

### 4. Host form (stepper)

- Step 1 adds Topic (from active topics, plus "Other") and Type (workshop, meetup, pop-up, flea market, online class). Choosing "online class" sets mode online.
- Step 2 for in-person is unchanged. For online: platform, start date, class days (chips), time, duration, optional end date, a price editor (up to 5 rows with presets, or Free), and the free-trial tick box. City, venue and seats are hidden for online.
- Step 3 adds languages, level, experience, certifications and WhatsApp.
- The server validates every field with the existing helpers in `src/lib/validate.ts` and `phone.ts`; the form mirrors the same limits (the existing rule for forms in this project).

### 5. "What we support" copy

One constant, `SUPPORTED_LISTINGS` in `src/lib/workshop-support.ts`, lists what can be listed (in-person workshops, meetups, pop-ups, flea markets; online classes once phase 1 ships). The `/workshops` header sub-line, the empty-state card and the host-form intro all read from it, so the wording follows what is built. A test checks that each entry has a matching option in the form's Type list. Wording stays short and generic, for example: "List a workshop, meetup, pop-up, flea market or online class."

### 6. Phase 2 (not built now)

Topic hierarchy screens and pages (`/workshops/yoga`, `/workshops/yoga/prenatal`, mirroring the category pages once PR #71 is merged); a `details` JSON column plus a small typed config per topic for prenatal questions (suitable trimester, medical advice, prenatal certification); a session table if per-date booking or cancellations are needed; language and topic filters.

## Constraints and risks

- Migration number: this branch's latest is 0025; `feat/category-pages` also adds 0026. Use the next free number at merge time.
- About 16 test files read or write `workshops.price_paise`, `venue`, `city_id` or `starts_at` through `createWorkshop`, `workshopsQuery`, the fixture or `toWorkshop` (admin, admin-api, users-api, orders, catalog, cities, city-links, jsonld, live-catalog, trending-pages, db-schema, pg-concurrency and others). The domain type `Workshop` gets nullable `cityId`, `venue`, `seats`; consumers must handle null.
- The email code flow, rate limits, honeypot and image upload rules stay as they are.
- Styles live in per-feature CSS files (standing project preference).

## Left to the builder

Exact CSS and component structure for the price editor and day chips; copy for the badges; column order in the migration; the dashboard list UI for topics (follow `SourcingTypesAdmin`).

## Decisions made by me (please check)

- Join link is not stored or shown at all; the instructor shares it after contact.
- Seeded topics: Yoga and Crochet.
- `price_paise` and `type` stay as a cache of the price rows.
- Recurrence is a weekly `schedule` JSON, not a sessions table.
- `details` JSON waits for phase 2.
- Mode filter only; no topic or language filter in phase 1.

## Open questions for you

1. Should phase 1 include the "Approve and list" button (section 2)? Without it, an admin has to create each listing through the API by hand.
2. Should past listings leave `/workshops` and the sitemap (section 3)? Today they never do.
3. For online classes, is contact-only (WhatsApp / Instagram) right, or do you want booking with seats?
