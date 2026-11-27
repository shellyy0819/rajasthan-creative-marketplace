# Fair players: a per-player journey in the admin dashboard

Approved in conversation on 2026-11-24 (short design, small-to-medium change).

## Intent
The owner wants to see, per player of the Craftofy Fair, how much they play and whether they finish the day's quests, so they can follow a visitor's journey through the exhibition. Today `fair_quest_days` holds quest progress per code per day, but play time and the order of actions are not stored anywhere (the live presence row is deleted after 60 seconds; stalls and shortlist items stay in the browser).

## Goals
- An admin-only page `/dashboard/fair-players` with one row per player code: first and last visit, days played, minutes played, stalls visited, items shortlisted, and quests done out of 3.
- Recording for everyone who plays, whether or not they accepted Analytics (owner's call: it is first-party data tied to a code the visitor claimed; gating on consent would leave the page mostly empty).

## Non-goals and anti-goals
- No name, email or sign-in is attached to a player. The random player code is the only key.
- The player code and its secret are never sent to Google Analytics (the GA fair events stay anonymous).
- Not a replacement for the GA funnel; no per-event timeline view in this change.
- Must not slow the game or break it when the endpoint is down.

## Approaches
1. **Two small tables plus an events endpoint (chosen).** `fair_events` (one row per action) and `fair_play_days` (one row per code per day, with seconds). Minutes come from the existing heartbeat. Small, queryable, no change to how the game works.
2. Everything in `fair_events`, including a row per heartbeat. Rejected: one row every 2.5 seconds per player is large for a number that one counter gives.
3. Derive everything from GA4 through its API. Rejected: consent-only, per browser not per code, and would need the code sent to Google.

## Design
- **`fair_events`**: `id`, `code`, `kind` (`stall`, `shortlist`, `activity`, `quest`), `detail` (maker id, item key, activity name or quest id, max 80 chars), `at`. Index on `(code, at)`.
- **`fair_play_days`**: primary key `(code, day)` with `day` as an IST date like `fair_quest_days`, `seconds`, `first_at`, `last_at`. The heartbeat adds the gap since the player's previous heartbeat when it is under 15 seconds (so an idle tab or a closed laptop adds nothing).
- **`POST /api/fair/events`**: body `{ code, token, events: [{ kind, detail }] }`, at most 10 per call. Validated like the notes route: fair must be open, bots refused, rate limited per IP and per code, and the code must belong to the sender. Unknown kinds are rejected.
- **Client**: the places that already send the GA fair events also queue a first-party event, sent in small batches. A failure is ignored, never shown, never retried forever.
- **Page**: `requireAdminPage()` like the other dashboard pages (sellers get a 404), listed in the dashboard navigation next to Fair feedback. Stalls visited counts distinct makers; shortlisted counts shortlist events; quests is the latest played day, 0 to 3, with a filter for players who finished all three. Minutes are summed over days.
- **Retention**: events and play days older than 90 days are deleted (the owner's default, to be confirmed by counsel).
- **Privacy page**: one line under "If you only browse" saying the fair keeps what a player code did there, with the retention period. The privacy page is already a draft for legal review.

## Constraints
- Migrations are run against the local database first (`.env.local`, port 5434). The production database is not touched from here.
- Admin-only access stays; no seller access.
- Tests first for the parsing, the minutes rule, the retention rule and the page's numbers.

## Left to the builder
Column order and styling of the page (follow the Fair feedback page and the site's design rules), the batching interval on the client, and the exact wording of the privacy line.
