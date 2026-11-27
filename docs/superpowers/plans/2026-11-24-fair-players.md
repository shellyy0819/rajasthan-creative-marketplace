# Fair players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record what each fair player code does and show it per player on an admin-only page `/dashboard/fair-players`.

**Architecture:** Two small tables (`fair_events` for actions, `fair_play_days` for seconds played per code per day). Play seconds are added by the existing heartbeat. The browser batches the actions it already tracks for GA into a new `POST /api/fair/events`, accepted only for a code the sender owns. A server-rendered admin page reads both tables plus `fair_quest_days`.

**Tech Stack:** Next.js (breaking-changes version: read `node_modules/next/dist/docs/` before touching routes or pages), Drizzle ORM + PostgreSQL, vitest with PGlite (`tests/helpers/testdb.ts`), React.

**Spec:** `docs/superpowers/specs/2026-11-24-fair-players-design.md`

## Global Constraints

- Recorded for everyone who plays, whether or not they accepted Analytics.
- No name, email or sign-in is attached; the random player code is the only key. The code and its token are never sent to Google Analytics.
- Admin only: use `requireAdminPage()`; sellers get a 404. No seller access.
- Retention: events and play days older than 90 days are deleted.
- `detail` is at most 80 characters; at most 10 events per call; kinds are exactly `stall`, `shortlist`, `activity`, `quest`.
- A play gap counts only if under 15 seconds (`PLAY_GAP_MAX_MS = 15_000`).
- Play days use the IST calendar date (UTC+5:30), like the rest of the fair.
- The game must never slow down or show an error because the events call failed.
- Migrate the local database only (`.env.local`, port 5434). Never touch the database in `.env.backend`.
- Admin page follows the `rang-rajasthan-design` skill (site type scale, existing admin classes, no new colours or font sizes) and has `<Breadcrumbs>` (`tests/breadcrumbs.test.tsx` enforces it).
- Do not commit or push unless the owner asks. The uncommitted GA fair events in the working tree are separate work; do not revert them.

## Review Focus

- A tab left open or a closed laptop (gap over 15 s) adds no play time: Task 3 test.
- Events for a code owned by someone else are refused with 409 and nothing is stored: Task 2 test.
- A batch of 11, an unknown kind, or a detail over 80 characters is rejected with 400: Task 2 test.
- A player who has events but no play-day row still appears on the page: Task 5 test.
- Play across IST midnight lands on the right IST day, and rows older than 90 days are deleted: Task 3 and Task 2 tests.

## File Structure

- `src/db/schema.ts` (modify) and `drizzle/0038_*.sql` plus `drizzle/meta/*` (generated): the two tables.
- `src/lib/fair-events.ts` (create): kinds, parsing, saving events, retention.
- `src/lib/fair-play.ts` (create): IST day, play-seconds rule, adding play time.
- `src/lib/fair-presence.ts` (modify): the heartbeat calls `addPlay`.
- `src/lib/fair-limits.ts` (modify): two limiters.
- `src/app/api/fair/events/route.ts` (create): the endpoint.
- `src/components/fair/event-log.ts` (create): the browser batching queue.
- `src/components/fair/FairGame.tsx` (modify): feed the queue next to the GA calls.
- `src/lib/fair-players.ts` (create): the per-player summary.
- `src/app/dashboard/fair-players/page.tsx` (create), `src/components/AdminTabs.tsx` (modify).
- `src/app/privacy/page.tsx` (modify): one line.
- Tests: `tests/fair-events-store.test.ts`, `tests/fair-play.test.ts`, `tests/fair-event-log.test.ts`, `tests/fair-players.test.ts`.

### Task 1: Tables and migration

**Files:**
- Modify: `src/db/schema.ts` (next to `fairNotes`/`fairQuestDays`)
- Create (generated): `drizzle/0038_*.sql`, `drizzle/meta/0038_snapshot.json`, journal entry
- Test: `tests/fair-events-store.test.ts` (first test only)

**Interfaces:**
- Produces: `fairEvents` (`id` bigserial number, `code` text, `kind` text, `detail` text, `at` timestamptz Date, default now) with a CHECK on the four kinds and indexes `(code, at)` and `(at)`; `fairPlayDays` (`code` text, `day` text yyyy-mm-dd, `seconds` integer default 0, `firstAt` and `lastAt` timestamptz Date) with primary key `(code, day)` and an index on `day`.

- [ ] **Step 1: Write the failing test** `it('has the two tables')`: after `getTestDb()`, insert one row into each table through Drizzle and read it back; insert a `fairEvents` row with kind `'fly'` and expect it to throw.
- [ ] **Step 2: Run** `npx vitest run tests/fair-events-store.test.ts` (Node 22). Expected: FAIL, tables missing.
- [ ] **Step 3: Add both tables to `src/db/schema.ts`** with a doc comment saying they hold no personal data (a random code, an action and a time). Then run `npx drizzle-kit generate` (needs no database) and check the SQL file creates only these two tables and their indexes.
- [ ] **Step 4: Run the test again.** Expected: PASS.
- [ ] **Step 5: Migrate the local database:** `npm run db:migrate` (reads `.env.local`). Expected: no error; confirm with `psql` or a one-line script that both tables exist locally.

### Task 2: Saving events

**Files:**
- Create: `src/lib/fair-events.ts`
- Modify: `src/lib/fair-limits.ts` (add `eventIpLimiter = createLimiter(120, 60_000)` and `eventCodeLimiter = createLimiter(30, 60_000)`, same style as the note limiters)
- Test: `tests/fair-events-store.test.ts`

**Interfaces:**
- Produces: `FAIR_EVENT_KINDS = ['stall','shortlist','activity','quest'] as const`, `type FairEventKind`, `type FairEventInput = { kind: FairEventKind; detail: string }`, `MAX_EVENTS_PER_CALL = 10`, `DETAIL_MAX = 80`, `EVENT_KEEP_DAYS = 90`; `parseEvents(input: unknown): { code: string; token: string; events: FairEventInput[] }` (uses `parseClaim`, `obj`, `bad`; throws 400); `recordEvents(e: ReturnType<typeof parseEvents>, now?: Date): Promise<{ saved: number }>` (throws `ApiError(409, CODE_TAKEN)` when the code is not the sender's; deletes events older than 90 days after saving).

- [ ] **Step 1: Write failing tests** in `tests/fair-events-store.test.ts` (use `resetTestDb()` in `beforeEach`, like `tests/fair-quest-days.test.ts`):
  - `parseEvents` accepts 1 and 10 events; rejects 0, 11, an unknown kind, a non-string detail, an empty detail, and a detail of 81 characters (each with a message matching `/events|kind|detail/`).
  - `recordEvents` stores events under the code with the given `now`.
  - a second token for the same code gets `ApiError` status 409 and no rows are stored.
  - a row 91 days old is deleted by the next `recordEvents`; a row 89 days old stays.
- [ ] **Step 2: Run, expect FAIL** (module missing).
- [ ] **Step 3: Implement** the signatures above in `src/lib/fair-events.ts`, modelled on `src/lib/fair-notes.ts` and `src/lib/fair-quest-days.ts`.
- [ ] **Step 4: Run, expect PASS.**

### Task 3: Play time from the heartbeat

**Files:**
- Create: `src/lib/fair-play.ts`
- Modify: `src/lib/fair-presence.ts` (`heartbeat`: read the code's previous `seenAt` from `fairVisitors` before the upsert, then `await addPlay(hb.code, prev, now)` after the claim succeeds)
- Test: `tests/fair-play.test.ts`

**Interfaces:**
- Consumes: `fairPlayDays`, `EVENT_KEEP_DAYS` from Task 2.
- Produces: `PLAY_GAP_MAX_MS = 15_000`; `istDay(d: Date): string` (yyyy-mm-dd in UTC+5:30); `playSecondsFor(prevSeenAt: Date | null, now: Date): number` (whole seconds; 0 when `prevSeenAt` is null, not before `now`, or more than 15 s earlier); `addPlay(code: string, prevSeenAt: Date | null, now?: Date): Promise<void>` (upserts the `(code, istDay(now))` row: seconds plus `playSecondsFor`, `firstAt` set on insert, `lastAt` = now; also deletes play days older than 90 days).

- [ ] **Step 1: Write failing tests:**
  - `playSecondsFor(null, now)` is 0; 2.5 s gap is 2; 14 s gap is 14; 16 s gap is 0; a negative gap is 0.
  - `istDay(new Date('2026-11-12T18:29:59Z'))` is `'2026-11-12'` and `istDay(new Date('2026-11-12T18:30:00Z'))` is `'2026-11-13'`.
  - three `heartbeat` calls 2.5 s apart for one code leave one `fair_play_days` row with 5 seconds; a fourth call 60 s later adds 0 and moves `lastAt` (use the helpers in `tests/fair-presence.test.ts` for building a heartbeat).
  - two heartbeats either side of IST midnight create two day rows.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `fair-play.ts` and the one-line call in `heartbeat`.
- [ ] **Step 4: Run these tests and `tests/fair-presence.test.ts`.** Expected: PASS.

### Task 4: The events endpoint

**Files:**
- Create: `src/app/api/fair/events/route.ts`
- Test: `tests/fair-api.test.ts` (add a `describe('POST /api/fair/events')`)

**Interfaces:**
- Consumes: `parseEvents`, `recordEvents`, `eventIpLimiter`, `eventCodeLimiter`.
- Produces: `POST` handler like `src/app/api/fair/notes/route.ts`: bots get 403, the fair must be open (`requireFairOpen`), per-IP then per-code rate limit (429), `json({ saved }, 200, { 'cache-control': 'no-store' })`.

- [ ] **Step 1: Write failing tests** following the existing presence/notes tests in `tests/fair-api.test.ts`: a valid call returns 200 `{ saved: 2 }`; a code owned by someone else returns 409; 11 events return 400; a bot user agent returns 403; a closed fair is refused the same way as notes.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement the route.**
- [ ] **Step 4: Run, expect PASS.**

### Task 5: The page's numbers

**Files:**
- Create: `src/lib/fair-players.ts`
- Test: `tests/fair-players.test.ts`

**Interfaces:**
- Consumes: `fairEvents`, `fairPlayDays`, `fairQuestDays`.
- Produces: `type FairPlayer = { code: string; firstSeen: string; lastSeen: string; days: number; minutes: number; stalls: number; shortlisted: number; questsDone: number; questsTotal: number }` (dates as ISO strings); `listPlayers(opts?: { finishedAll?: boolean; limit?: number }): Promise<FairPlayer[]>` (default limit 200, newest `lastSeen` first).

Rules: a player is any code with a play-day row or an event. `firstSeen`/`lastSeen` are the earliest and latest of play-day `firstAt`/`lastAt` and event `at`. `days` counts play-day rows. `minutes` is the sum of seconds divided by 60, rounded down. `stalls` counts distinct `detail` of `stall` events; `shortlisted` counts `shortlist` events. Quests come from the player's latest `fair_quest_days` row: `questsDone` counts quests whose progress list has at least `target` entries, `questsTotal` is the snapshot length; a player with no quest row has 0 and 0. `finishedAll` keeps players with `questsTotal > 0 && questsDone === questsTotal`. Several grouped queries merged in JS is fine for this size.

- [ ] **Step 1: Write failing tests** seeding rows directly: one full player (3 play days of 600, 300 and 59 seconds gives 15 minutes and 3 days; 5 stall events over 4 distinct makers gives 4; 2 shortlist events gives 2; latest quest day with 3 quests, 2 complete gives 2 of 3); a player with events only (appears, 0 minutes, 0 days); a player with no quest row (0 of 0); ordering by `lastSeen`; `finishedAll` returns only the player with 3 of 3.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `listPlayers`.**
- [ ] **Step 4: Run, expect PASS.**

### Task 6: The admin page

**Files:**
- Create: `src/app/dashboard/fair-players/page.tsx`
- Modify: `src/components/AdminTabs.tsx` (add `{ href: '/dashboard/fair-players', label: 'Fair players' }` right after Fair feedback)
- Test: `tests/fair-players.test.ts` (source-contract tests)

**Interfaces:**
- Consumes: `listPlayers`, `requireAdminPage`, `Breadcrumbs`.
- Produces: a server component modelled on `src/app/dashboard/fair-notes/page.tsx`: crumbs Home > Dashboard > Fair players; an intro line saying codes are random and not names; a table with columns Code, First seen, Last seen, Days, Minutes, Stalls, Shortlisted, Quests (`2 of 3`, or `—` when `questsTotal` is 0); a link toggling `?done=all` ("Show only players who finished all quests"). Read `node_modules/next/dist/docs/` for how `searchParams` is received in this Next version. Dates in IST, short form. Use the site's existing admin table classes and type scale.

- [ ] **Step 1: Write failing source-contract tests:** the page source calls `requireAdminPage()` before reading data and renders `<Breadcrumbs`; `AdminTabs.tsx` lists `/dashboard/fair-players` directly after `/dashboard/fair-notes`; `tests/breadcrumbs.test.tsx` still passes.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement the page and the tab.**
- [ ] **Step 4: Run, expect PASS.** Then load the page signed in as admin on the local dev server at phone width (390px) and laptop width and check the table scrolls inside its own container with no horizontal page scroll (the dev server on port 3000 is the owner's: use it, do not restart it).

### Task 7: The browser queue and the game

**Files:**
- Create: `src/components/fair/event-log.ts`
- Modify: `src/components/fair/FairGame.tsx`
- Test: `tests/fair-event-log.test.ts`

**Interfaces:**
- Consumes: `FairEventKind`, `FairEventInput`, `MAX_EVENTS_PER_CALL` (type and constant imports only).
- Produces: `createFairLog(send: (events: FairEventInput[]) => Promise<unknown> | unknown, opts?: { intervalMs?: number }): { add(kind: FairEventKind, detail: string): void; flush(): void; destroy(): void }`. Behaviour: `add` trims `detail` to 80 characters and queues (at most 50 queued, oldest dropped); a timer (default 5000 ms) flushes while the queue is non-empty; `flush` sends in batches of at most 10; `flush` also runs on `visibilitychange` to hidden and on `pagehide`; a `send` that throws or rejects is ignored (no retry, no error shown); `destroy` flushes once and removes the listeners.

- [ ] **Step 1: Write failing tests** (fake timers, jsdom): 3 adds then 5 s sends one batch of 3; 25 adds send batches of 10, 10, 5; a rejecting `send` does not throw and the queue is empty afterwards; a 100-character detail is sent as 80; hiding the page (`visibilitychange` with `document.visibilityState = 'hidden'`) flushes immediately; 60 adds keep only the newest 50; `destroy` flushes and stops the timer.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `event-log.ts`.**
- [ ] **Step 4: Wire `FairGame.tsx`:** create the log once in an effect, with `send = events => fetch('/api/fair/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: codeRef.current, token: tokenRef.current, events }), keepalive: true })`; destroy it on cleanup. Next to each existing GA call add one `logRef.current?.add(...)`: `stall` with `slot.maker.id`; `shortlist` with `item.key`; `activity` with `'balloon'`, `'music'`, `'holy_dip'` (and `'tug_of_war'` from `SportsSheet` through a new optional `onStart` prop); `quest` with `q.id` for each completed quest. Add a source-contract test in `tests/fair-event-log.test.ts` that each of these call sites exists.
- [ ] **Step 5: Run these tests, `tests/fair-game.test.tsx`, `tests/fair-events.test.tsx` and `npx tsc --noEmit`.** Expected: PASS and no type errors.

### Task 8: Privacy line, end-to-end check, full run

**Files:**
- Modify: `src/app/privacy/page.tsx` (one bullet under "If you only browse": the fair keeps what a player code did there, namely stalls opened, items added to the shortlist, activities started, quests finished and time played, for 90 days, linked to the random code and not to a name; add `[Counsel to confirm whether this needs consent.]` in the draft's bracket style)
- Test: `tests/fair-players.test.ts` (privacy source contract: the page mentions the fair play record and 90 days)

- [ ] **Step 1: Write the failing privacy test, run it (FAIL), add the bullet, run it (PASS).**
- [ ] **Step 2: End-to-end on the local app:** with the dev server on port 3000, open `/fair`, claim a code, walk to a stall, add an item, wait 10 s, then read `fair_events` and `fair_play_days` from the local database. Expected: a `stall` and a `shortlist` row for the code, and a play-day row with a few seconds.
- [ ] **Step 3: Full run:** `npx vitest run` (Node 22) and `npx tsc --noEmit`. Expected: no new failures. The database-backed tests can time out under load ("Hook timed out in 10000ms"); compare any failure with a run on a clean checkout before treating it as caused by this work.
- [ ] **Step 4: Report** what was verified and what was not, and ask the owner whether to commit (the GA fair events and this feature are separate commits).
