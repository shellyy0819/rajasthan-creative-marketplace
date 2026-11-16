# Shilpgram Utsav, Udaipur: a second fair festival

## Intent
Craftofy's walk-around fair (`/fair`) gets a Shilpgram Utsav edition at its own URL. The point is not only fun: people who play should come away knowing that Udaipur is a centre of handicraft and of the people who make it, that Shilpgram Utsav exists, and that Craftofy is the site where those artists are supported. Success is a visitor who ends up on a real Udaipur maker's page and contacts them; page views alone are not the goal.

## Goals
- A page at `/fair/shilpgram-udaipur` (see URL) that ranks for "Shilpgram Udaipur / Shilpgram Utsav / Shilpgram mela" and is useful to someone planning a visit.
- A game on that page, built on the existing fair engine, themed as a craft village, that teaches a craft fact per stop and ends at real Udaipur sellers.
- Metadata, structured data, sitemap and llms.txt that follow the festival's dates automatically, with the dates editable by an admin (Dashboard > Settings > Fair), as the Pushkar dates now are.
- Reusable for the next festival: the Pushkar schedule becomes one entry in a list of festivals.

## Non-goals
- No payments, tickets or ticket resale (Craftofy takes no payments; ticket prices are only quoted as "confirm at the gate").
- No live stream, no real-time sync with the real event.
- No copied text, photos, logos or page structure from the source sites; facts are restated in our own words and drawings are our own.
- No change to how Pushkar plays, beyond moving its dates into the shared festival list.

## Anti-goals (would be failure even if it works)
- Implying WZCC, Shilpgram or the Ministry runs or endorses Craftofy.
- Showing 2026 dates as confirmed when they are not (sources disagree: 21 to 30 Dec vs 21 to 31 Dec; the 2026 dates are inferred from the usual schedule).
- Thin, near-duplicate pages, or a page whose facts go stale after the event.

## Constraints
- Facts come from public pages (insideudaipur, deshraah, hellotravel) and are restated, never quoted. Where sources conflict or say nothing (entry fee, end date), the page says "check official dates and fees" and offers no number we cannot back.
- Node 22 for tests; local DB on :5434; the dev server on :3000 belongs to the user.
- Pushkar work (camel finery, admin dates) is in flight on the same files (`fair-mela.ts`, `fair-settings.ts`, `FairSettingsForm.tsx`, `fair/page.tsx`); this builds on it.

## URL (recommendation, my call)
`/fair/shilpgram-udaipur`. Hyphens are read by search engines as word breaks; `shilpgramudaipur` reads as one unknown word. The URL has no year, so it keeps its links and ranking every December. `/fair/shilpgramudaipur` (what the user typed) gets a permanent redirect to it. `/fair` stays the general fair.

## Approaches considered
1. Reskin `/fair` as another dressing (like Pushkar): fastest, but two festivals share one URL, so Shilpgram has no page of its own for search. Rejected.
2. **Own page on the shared engine (chosen, recommended).** Reuses the engine; own URL, metadata and facts; game ends at sellers.
3. Content hub with no game: best for search, nothing keeps people on the page. Rejected as the main build; the facts section below the game gives most of its search value.

## Design
**Festival list.** Replace the single Pushkar schedule with festivals keyed by slug (`pushkar`, `shilpgram-udaipur`), each with name, place, organiser, dates, and its own theme/quests. Stored in fair settings (`festivals[slug] = { on, first, last, confirmed }`), each editable as a card under Dashboard > Settings > Fair. Dates validated as real and ordered. Defaults: Pushkar as now; Shilpgram 21 to 30 Dec 2026, `confirmed: false`.

**Game.** Same floor and engine, dressed as a craft village: huts labelled by state (Rajasthan, Gujarat, Maharashtra, Goa, Odisha, West Bengal, Assam, Punjab), the open-air evening stage (Muktakashi Manch), a wandering Bahurupiya who tells craft facts. Time of day follows IST: stalls and demos by day, street shows in the afternoon, the stage lit from evening. `?day=` previews it, as for Pushkar.
- **Craft passport:** a stamp at each hut for reading one craft fact (block printing, Molela terracotta, Mewar miniature, Pichwai, blue pottery, mojari, bandhani, Warli, Madhubani).
- **Finale:** "Meet Udaipur's makers": real sellers whose city is Udaipur, with links to their artist pages and shortlist. Contact is direct with the maker. If there are none, link to the Udaipur city page and say more makers are joining.

**Page content (server-rendered, below the game).** What it is, when and where (with the unconfirmed-dates note until an admin confirms), timings of the day, crafts, dances and music, food, how to reach it, and a line on Craftofy's makers in Udaipur. Written from facts, in our words.

**SEO (dynamic from the festival's dates).**
- `generateMetadata`: title like "Shilpgram Utsav 2026, Udaipur: dates, timings, crafts and folk shows | Craftofy"; description; self canonical; Open Graph with a generated card (text, our drawing).
- JSON-LD: `Event` (name, startDate, endDate, offline attendance, Place Shilpgram, Udaipur, Rajasthan, India; organiser WZCC; no `offers`), plus `BreadcrumbList`. `Event` only when dates are confirmed; unconfirmed dates read "expected" in the text.
- After the last day: the page stays, the title and copy switch to "next edition expected in December", `Event` is dropped until the next dates are set. Year in the title comes from the dates.
- Sitemap entry, `llms.txt` line, links from `/fair`, `/cities/udaipur` and the home page.

## Left to the builder
Hut and stage artwork; exact passport facts and copy; quest ids and counts; the generated Open Graph card; test updates (fair-mela and settings tests change shape); how the Pushkar dates migrate into the festivals list without losing saved admin dates.

## Calls made after the builder check (mine, marked for review)
- **Layout:** same eight-slot floor as `/fair`. Huts and the stage are dressings on open slots, the way Pushkar already turns slots into the lake, music stage and sports ring. No new engine geometry.
- **Festival selection:** `/fair` shows only the Pushkar dressing, on Pushkar's dates. Shilpgram's dressing appears only at `/fair/shilpgram-udaipur`. The two never compete. `?day=` previews either, on its own URL.
- **Fair closed:** the Shilpgram page stays up as an indexable facts page; only the game is replaced by the closed notice, and the `/api/fair` guards are unchanged. A festival's `on` flag off hides the game and the Event data, and drops the page from the sitemap.
- **Progress:** the passport and its quests are stored like existing quests, under a festival key so Pushkar visitors keep their state. New quest ids go in `fair-constants`.
- **Confirmed:** `confirmed` only gates the Event JSON-LD and the wording. Unconfirmed: title keeps the year with "expected", text says "dates expected, check official announcements". After the last day: "next edition expected in December" unless an admin has entered newer dates.
- **Redirect:** a permanent redirect from `/fair/shilpgramudaipur`, placed where this Next version documents it (checked in `node_modules/next/dist/docs/` before building).
- **Branches:** the Pushkar work (camel finery, admin dates) is committed on its own branch first; Shilpgram is built on top of it.
