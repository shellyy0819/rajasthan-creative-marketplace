# Market Trends, Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin fetches arts, crafts and workshop trends with Gemini plus Google Search (or adds them by hand), checks them, previews them on the real `/trending` page, and publishes them for everyone.

**Architecture:** A `trend_digests` table holds one row per fetch, with its items in a jsonb column. A small lib layer (types, settings, research, matching, store, fetch) sits behind admin-only API routes. The admin page `/dashboard/market-trends` mirrors the Themes admin (cards, badges, "Preview on site"). Preview is an admin-only cookie, like the theme preview, and `/trending` renders a new server component, `TrendsBlock`, from the published digest, or from the previewed one for that admin.

**Tech Stack:** Next.js (App Router, read `node_modules/next/dist/docs/` first, see constraints), Drizzle on Postgres, vitest with PGlite, plain `fetch` to the Gemini REST API, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-25-weekly-trends-design.md`. Design mockups: https://claude.ai/artifact/Nk4SeMErTTSBfEhn7HT1iq (laptop, phone, admin, preview boards; sample data there is invented).

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers, cookies or dynamic params (AGENTS.md: this Next version has breaking changes). Existing pages show `params` as a `Promise`.
- All triggers are manual. No cron, no scheduler endpoint, nothing sends or publishes by itself.
- Admin only. Every new API route calls `requireAdmin(await auth())`; every new dashboard page calls `requireAdminPage()`. Existing role gates stay as they are.
- The Gemini key is sealed with `seal`/`open` from `src/lib/secret-box.ts` in `app_settings`; the admin view shows only whether a key is saved and its last 4 characters; a blank save keeps the saved key; fallback env var `GEMINI_API_KEY`; the key never reaches the browser, logs or error messages.
- No Gemini SDK: plain HTTPS `fetch`, behind `researchTrends` only, so the model can be swapped.
- Nothing hardcoded: no place or brand name (such as "Rajasthan", city names, "Craftofy") in any heading, label, prompt or email. Brand comes from `SITE.name` (`src/lib/site.ts`), wording from `getCatalogWording`, the region from settings or the cities in use.
- Block heading follows the items: all `craft` gives "Crafts to look at", all `art` gives "Art to look at", a mix gives "Arts and crafts to look at"; no items means the block is hidden. The workshops block (eyebrow "People are looking for", heading "Workshops on the rise") appears only when it has items.
- Only one digest is published at a time; publishing replaces the previous one; a digest with no shown items cannot be published; a draft is invisible to visitors and to other admins.
- No outside photos or copied text on the public page; sources are credited by name, links only when `https:`.
- UI and fonts follow the design system in `.claude/skills/rang-rajasthan-design/SKILL.md`, read it in full before any UI task. The mockup is a layout reference only: it uses a literal `DM Sans` font-family, hex colours and its own sizes, and none of those may be copied.
  - Fonts: only `var(--font-sans)` for text and controls and `var(--font-display)` for headings and card titles. No `font-family`, no literal font name, no new family, no inline `fontFamily`. `tests/typography.test.ts` must stay green.
  - Colours: only the tokens in the skill (`--ink`, `--muted-2`, `--card-2`, `--line`, `--green`, `--orange`, `--chip-sand`, `--chip-green` and so on). No new hex values, so dark mode follows by itself. Text on an orange background is white.
  - Sizes: only the skill's type scale, checked against two sibling pages' CSS (`.page-head`, `.workshop-card`, `.detail`), not the mockup. Controls are `--control-h`, radius 3px, `--control-border`, `600 11px` font.
  - Reuse existing classes before writing CSS (`.page-head`, `.section`, `.eyebrow`, `.button`, `.button.primary`, `.danger-outline`, `.admin-row-actions`, `.badge`, `.settings-card`, `.admin-form`, `.festive-preview`). The only new stylesheet is `TrendsBlock.css`, with tokens and the sizes above.
  - Also required by the skill: `Toast` for action results, `PageLoader` for non-button waits, `aria-busy` on pending buttons, `required` plus `.lbl` on mandatory fields, `Breadcrumbs` on every page, visible focus ring kept, 390px, about 700px and 1280px checked, `npx tsc --noEmit` and `npm test` green.
- Local only: use `.env.local` (local DB on :5434), never `.env.backend` (production Neon). The dev server on :3000 is the user's: do not start or stop it. Run tests on Node 22 (`nvm use 22`).
- Work on a new branch `feat/market-trends` from `main`, in a git worktree, because `feat/fair-players` has uncommitted work that must not be touched. Plain commit messages with no `Co-Authored-By` line (the user's saved rule). The repo's git user is `shellyy0819`.

## Review Focus

Failure modes the spec implies that no feature task would otherwise test. Each has its test in the task named.

1. Gemini wraps its JSON in markdown fences or adds prose before and after: items must still parse (Task 3).
2. A source URL that is not `https:` (for example `javascript:`) or is not among the grounded pages: the source is dropped; an item left with no source is dropped; no items left means status `empty`, not invented content (Tasks 1 and 3).
3. Two admins, or a double click, press Fetch together: one Gemini call, the other gets 409 (Task 5).
4. Publishing while another digest is published, then unpublishing: never two published rows, and `/trending` shows nothing after unpublish (Tasks 4 and 7).
5. A forged or stale preview cookie (visitor, non-admin, unknown id, garbage text): ignored, only the published digest shows (Task 6).

## File Structure

| File | Responsibility |
|---|---|
| `src/db/schema.ts` (modify), `drizzle/00NN_*.sql (next number)` (generated) | `trend_digests` table |
| `src/lib/trend-types.ts` | Item types, validation, heading and source-line helpers (pure, no server imports) |
| `src/lib/trend-settings.ts` | Gemini key, model and region in `app_settings` |
| `src/lib/trend-research.ts` | Prompt, Gemini call, parsing, grounding check |
| `src/lib/trend-match.ts` | Match items to our topics and products, with counts and links |
| `src/lib/trend-store.ts` | Digest CRUD, publish, unpublish, reads |
| `src/lib/trend-fetch.ts` | Manual fetch orchestration: lock, gap, store |
| `src/lib/trend-preview.ts` | Preview cookie name and `getTrendsForPage()` |
| `src/app/api/admin/settings/trends/route.ts` | Key settings API |
| `src/app/api/admin/trends/**/route.ts` | Fetch, list, read, edit items, add, publish, unpublish, preview |
| `src/components/TrendSettingsForm.tsx` | Settings box (mirrors `EmailSettingsForm`) |
| `src/components/trends/TrendsBlock.tsx`, `TrendsBlock.css`, `TrendsPreviewBar.tsx` | Public block and the preview pill |
| `src/components/MarketTrendsAdmin.tsx`, `src/app/dashboard/market-trends/page.tsx` | Admin page |
| `src/app/trending/page.tsx`, `src/components/AdminTabs.tsx`, `src/app/dashboard/settings/page.tsx` (modify) | Wiring |

---

### Task 1: Table and shared types

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/lib/trend-types.ts`, `drizzle/00NN_*.sql (next number)` (via `npm run db:generate`)
- Test: `tests/trend-types.test.ts`, `tests/trend-digests-table.test.ts`

**Interfaces:**
- Produces (`trend-types.ts`):
  - `TREND_KINDS = ['craft','art','workshop'] as const`, `type TrendKind`; `TREND_ORIGINS = ['web','pinterest','manual'] as const`, `type TrendOrigin`
  - `type TrendSource = { title: string; url?: string }`
  - `type TrendItem = { id: string; kind: TrendKind; title: string; why: string; category?: string; tags: string[]; origin: TrendOrigin; sources: TrendSource[]; show: boolean }`
  - `parseItemInput(input: unknown, origin: TrendOrigin): Omit<TrendItem, 'id' | 'show'>` (throws `ApiError` 400; title 3 to 120, why 10 to 400, category 0 to 60, up to 6 tags of 1 to 30, 1 to 4 sources with title 2 to 80 and optional `https:` url up to 300; at least one source)
  - `trendBlockHeading(kinds: TrendKind[]): string | null`
  - `trendSourceLine(origins: TrendOrigin[]): string`
- Produces (schema): `trendDigests` table: `id uuid pk default random`, `createdAt timestamptz default now`, `createdBy text not null`, `model text not null`, `status text not null` (check `ok|empty|failed`), `error text null`, `items jsonb $type<TrendItem[]> not null default '[]'`, `publishedAt timestamptz null`, `publishedBy text null`; a partial unique index so at most one row has `published_at` set; index on `created_at`.

- [ ] **Step 1: Write the failing tests.** `trend-types.test.ts`: `trendBlockHeading(['craft','craft'])` is `'Crafts to look at'`; `['art']` is `'Art to look at'`; `['craft','art']` is `'Arts and crafts to look at'`; `[]` and `['workshop']` are `null`. `trendSourceLine(['pinterest','web','manual'])` is `'Gathered from Pinterest, public web sources and our own research, then picked by our team.'`; `['manual']` is `'Gathered from our own research, then picked by our team.'`. `parseItemInput` rejects (400) a source url `javascript:alert(1)`, `http://x.in`, zero sources, a 2-character title, 7 tags; accepts a title with `<script>` as plain text (stored as is, it is escaped at render). `trend-digests-table.test.ts` (PGlite via `getTestDb`): inserting a row with status `bogus` fails the check; inserting two rows with `published_at` set fails the unique index; two unpublished rows are fine.
- [ ] **Step 2: Run** `npx vitest run tests/trend-types.test.ts tests/trend-digests-table.test.ts`. Expected: FAIL (modules and table missing).
- [ ] **Step 3: Add `trendDigests` to `src/db/schema.ts`** following the style of `workshopEvents`, run `npm run db:generate`, and check the generated SQL file is the only new migration. Implement `trend-types.ts` (no server imports, so the browser can use it); validation style as in `src/lib/validate.ts` (`bad`, `text`).
- [ ] **Step 4: Run** the same command. Expected: PASS. Also `npx vitest run tests/db-schema.test.ts` still PASS.
- [ ] **Step 5: Commit** `git add src/db/schema.ts drizzle src/lib/trend-types.ts tests/trend-types.test.ts tests/trend-digests-table.test.ts && git commit -m "Market trends: the digest table and shared item types"`

### Task 2: Gemini key settings

**Files:**
- Create: `src/lib/trend-settings.ts`, `src/app/api/admin/settings/trends/route.ts`, `src/components/TrendSettingsForm.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Test: `tests/trend-settings.test.ts`, `tests/trend-settings-api.test.ts`, `tests/trend-settings-form.test.tsx`

**Interfaces:**
- Produces: `type TrendSettingsView = { keySet: boolean; keyHint?: string; model: string; region: string; source: 'saved' | 'environment' | 'none' }`; `type GeminiConfig = { apiKey: string; model: string; region: string }`; `DEFAULT_GEMINI_MODEL: string`; `getTrendSettings(): Promise<TrendSettingsView>`; `saveTrendSettings(input: unknown, actorEmail: string): Promise<TrendSettingsView>`; `clearTrendSettings(): Promise<TrendSettingsView>`; `resolveGeminiConfig(): Promise<GeminiConfig | null>` (`region` is the saved text, else the names of the cities in use joined with commas, else empty string).
- Consumes: `seal`/`open` (`secret-box.ts`), `appSettings`, `bad`, `obj`, `optionalText`.

- [ ] **Step 1: Write the failing tests**, copying the structure of `tests/email-settings.test.ts` and `tests/email-settings-api.test.ts`: starts `{ keySet: false, model: DEFAULT_GEMINI_MODEL, region: '', source: 'none' }`; saving stores the key sealed (row JSON does not contain the key, `updatedBy` is the actor) and the view shows only `keyHint` of the last 4; a blank key keeps the saved one; a first save with no key is 400 `/key is required/`; `GEMINI_API_KEY` env var is used when nothing is saved (`source: 'environment'`); model must match `/^[a-z0-9.-]{3,60}$/`, region at most 200 characters; `resolveGeminiConfig` falls back to city names when region is empty. API test: GET/PUT/DELETE are 401/403 for no session and non-admin, and no response body ever contains the key. Form test: shows "Key saved, ends in 1234" and never an input value for a saved key; Save is `aria-busy` while pending; an error shows inline.
- [ ] **Step 2: Run** `npx vitest run tests/trend-settings.test.ts tests/trend-settings-api.test.ts tests/trend-settings-form.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `trend-settings.ts` under `app_settings` key `'trends'`, mirroring `settings.ts` (a `readStored`/`saveEmailSettings` shaped pair). Route mirrors `src/app/api/admin/settings/email/route.ts` with `NO_STORE`. The form mirrors `EmailSettingsForm` (card `settings-card`, Toast, secret box left empty after save), with copy explaining the key comes from Google AI Studio and what the region box does ("Optional. Leave empty to use the cities listed on the site"). Add `<TrendSettingsForm initial={await getTrendSettings()} />` to the settings page after the email form. Set `DEFAULT_GEMINI_MODEL` to a current Gemini model id after checking Google's model list; note the choice in the commit message.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/trend-settings.ts src/app/api/admin/settings/trends src/components/TrendSettingsForm.tsx src/app/dashboard/settings/page.tsx tests/trend-settings*.test.ts* && git commit -m "Market trends: the Gemini key in Settings, saved encrypted like the mail key"`

### Task 3: Research with Gemini

**Files:**
- Create: `src/lib/trend-research.ts`
- Test: `tests/trend-research.test.ts` (mocks `globalThis.fetch`)

**Interfaces:**
- Consumes: `GeminiConfig` (Task 2), `TrendItem`, `parseItemInput` (Task 1), `ApiError` (`src/lib/errors.ts`).
- Produces: `buildPrompt(opts: { region: string; now: Date }): string`; `researchTrends(cfg: GeminiConfig, now?: Date): Promise<{ items: TrendItem[]; model: string }>` (items have `show: false`, origin `web`, fresh `id`s; throws `ApiError(502, message)` where the message never contains the key).

- [ ] **Step 1: Write the failing tests** with a fake Gemini response `{ candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: [{ web: { uri, title } }] } }] }`:
  - the request goes to `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` with header `x-goog-api-key`, a body containing `tools: [{ google_search: {} }]`, and the key is not in the URL;
  - the prompt contains the region text when given, contains no place or brand name when `region` is empty (assert against `/Rajasthan|Craftofy/`), and asks for JSON items with kind, title, why, category, tags and sources;
  - JSON inside a ```json fence, and JSON with prose before and after, both parse (Review Focus 1);
  - a source whose url is `javascript:alert(1)` or `http://…` is dropped, a source whose host is not among the grounded chunks (match `web.title` or the `web.uri` host) is dropped, an item left with no source is dropped, and all items dropped gives `items: []` (Review Focus 2);
  - an item with an unknown kind is dropped; at most 12 items are kept;
  - HTTP 400/403/429/500 each throw `ApiError(502)` with a plain message ("Gemini refused the key", "Gemini quota reached", "Gemini is not answering"), and a body that echoes the key is scrubbed (`***`);
  - a fetch that never resolves is aborted after 90 seconds (use fake timers), giving the "not answering" error.
- [ ] **Step 2: Run** `npx vitest run tests/trend-research.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Gemini cannot always combine the search tool with strict JSON output, so ask for JSON in the prompt and validate it ourselves with `parseItemInput` per item (try/catch per item, drop on failure). Take the first balanced `{…}` or `[…]` from the text. Grounding check as in the tests. Ids from `crypto.randomUUID()`. Before relying on the grounding match, make one real call with a real key locally and adjust the host matching to what the live response contains (Gemini often returns redirect URIs with the real domain in `title`); record what you saw in the commit message.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/trend-research.ts tests/trend-research.test.ts && git commit -m "Market trends: research with Gemini and Google Search, sources kept only when grounded"`

### Task 4: Store, publish and match

**Files:**
- Create: `src/lib/trend-store.ts`, `src/lib/trend-match.ts`
- Test: `tests/trend-store.test.ts`, `tests/trend-match.test.ts`

**Interfaces:**
- Produces (`trend-store.ts`): `type Digest = { id: string; createdAt: Date; createdBy: string; model: string; status: 'ok' | 'empty' | 'failed'; error: string | null; items: TrendItem[]; publishedAt: Date | null; publishedBy: string | null }`; `createDigest(i: { createdBy: string; model: string; status: Digest['status']; error?: string; items: TrendItem[] }): Promise<Digest>`; `listDigests(): Promise<Omit<Digest, 'items'> & { itemCount: number; shownCount: number }[]>` newest first; `getDigest(id: string): Promise<Digest | null>` (null for a non-uuid id); `patchItem(digestId: string, itemId: string, patch: { show?: boolean; kind?: TrendKind } & Partial<Pick<TrendItem, 'title' | 'why' | 'category' | 'tags' | 'sources'>>): Promise<Digest>`; `addItem(digestId: string, input: unknown, origin: 'pinterest' | 'manual'): Promise<Digest>`; `publishDigest(id: string, actorEmail: string): Promise<Digest>`; `unpublishDigest(id: string): Promise<Digest>`; `getPublishedDigest(): Promise<Digest | null>`. Errors are `ApiError`: 404 unknown digest or item, 409 editing a published digest ("Unpublish it first."), 400 publishing a digest with no shown items or status not `ok`.
- Produces (`trend-match.ts`): `type MatchedItem = TrendItem & { count: number; href: string }`; `matchItems(items: TrendItem[]): Promise<MatchedItem[]>`. Workshop items: the active `workshop_topics` name that appears (case-insensitive, longest wins) in the title and tags, counted as approved, not-ended workshops with that `topic_id` (reuse `isCurrent` from `workshop-listing.ts`), `href` is `/workshops?q=<topic name>`, count 0 and `/workshops` when no topic matches. Craft and art items: for each of `[category, ...tags]` call `countProducts({ q })`, keep the best (largest count) term, `href` is `/shop?q=<that term>`, count 0 and `/shop` when none match.

- [ ] **Step 1: Write the failing tests.** Store (PGlite via `resetTestDb`): create then `getDigest` round-trips items; `patchItem` toggles `show` and changes `kind`, 409 on a published digest, 404 on an unknown item id; `addItem` appends an item with `show: false` and the given origin and rejects invalid input with 400; `publishDigest` needs at least one shown item and status `ok` (400 otherwise); publishing B while A is published leaves exactly one row with `published_at` (A cleared, B set, `publishedBy` set) (Review Focus 4); `unpublishDigest` leaves none and `getPublishedDigest()` is null. Match (fixture topics and products from `tests/fixtures/db.json`): a workshop item titled with a fixture topic name gets that topic's count of approved current workshops, an ended or draft workshop is not counted; an unmatched workshop item gets count 0 and `/workshops`; a craft item whose tag equals a fixture product category gets a count above 0 and an `href` of `/shop?q=` plus the URL-encoded term.
- [ ] **Step 2: Run** `npx vitest run tests/trend-store.test.ts tests/trend-match.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `publishDigest` runs in one transaction: clear `published_at` on any other row, then set it on this one (the unique index is the backstop). Item edits rewrite the jsonb array in a transaction with `select … for update` on the row. `getDigest` treats a malformed id as null without hitting the database.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/trend-store.ts src/lib/trend-match.ts tests/trend-store.test.ts tests/trend-match.test.ts && git commit -m "Market trends: store, publish one digest at a time, match items to our shop and workshops"`

### Task 5: Manual fetch

**Files:**
- Create: `src/lib/trend-fetch.ts`
- Test: `tests/trend-fetch.test.ts`

**Interfaces:**
- Consumes: `resolveGeminiConfig`, `researchTrends`, `createDigest`, `listDigests`.
- Produces: `MIN_GAP_SECONDS = 60`; `runTrendFetch(actorEmail: string, now?: Date): Promise<Digest>`. 400 "Add the Gemini key in Settings first." when no config; 409 "A fetch is already running." while one is in progress (module-level flag, cleared in `finally`); 429 "Wait N seconds before fetching again." when the newest digest is under `MIN_GAP_SECONDS` old; stores status `ok` for items, `empty` for none, and on a research error stores a `failed` digest (message sanitized) and rethrows.

- [ ] **Step 1: Write the failing tests** (mock `researchTrends` with `vi.mock`): no key gives 400 and no row; ok result stores a draft with items all `show: false`; zero items stores status `empty`; a thrown `ApiError(502)` stores a `failed` row and rethrows; two calls started together (second before the first resolves) make exactly one `researchTrends` call and the second rejects 409 (Review Focus 3); a fetch within 60 seconds of the last digest rejects 429 with the remaining seconds, and one after the gap succeeds; the flag is cleared after a failure so the next fetch can run.
- [ ] **Step 2: Run** `npx vitest run tests/trend-fetch.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `runTrendFetch` as described. The gap check reads `listDigests()[0]`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/trend-fetch.ts tests/trend-fetch.test.ts && git commit -m "Market trends: a manual fetch that runs once at a time"`

### Task 6: Admin API and preview cookie

**Files:**
- Create: `src/lib/trend-preview.ts`, `src/app/api/admin/trends/route.ts` (GET list, POST fetch), `src/app/api/admin/trends/[id]/route.ts` (GET digest with matches), `src/app/api/admin/trends/[id]/items/route.ts` (POST add), `src/app/api/admin/trends/[id]/items/[itemId]/route.ts` (PATCH), `src/app/api/admin/trends/[id]/publish/route.ts` (POST publish, DELETE unpublish), `src/app/api/admin/trends/preview/route.ts` (POST set `{ id }`, DELETE clear)
- Test: `tests/trend-admin-api.test.ts`, `tests/trend-preview.test.ts`

**Interfaces:**
- Produces (`trend-preview.ts`): `TREND_PREVIEW_COOKIE = 'rr_trend_preview'`; `type TrendsForPage = { items: MatchedItem[]; sourceLine: string; updatedOn: Date; previewing: boolean }`; `getTrendsForPage(): Promise<TrendsForPage | null>`: when a signed-in admin has the cookie with a valid uuid of an existing digest, use that digest; otherwise the published digest; keep only `show` items; return null when none remain. `updatedOn` is `publishedAt ?? createdAt`.
- Consumes: Tasks 1 to 5. Routes follow `src/app/api/admin/themes/preview/route.ts` and `src/app/api/admin/settings/email/route.ts` (cookie helper, `handle`, `json`, `NO_STORE`, `requireAdmin`); publish and unpublish also call `revalidatePath('/trending')`.

- [ ] **Step 1: Write the failing tests.** API: every route gives 401/403 to no session and to a non-admin (table-driven over all routes and methods); POST fetch maps `runTrendFetch` errors to their status; PATCH and add reject bad bodies with 400 and a published digest with 409; publish and unpublish respond with the digest. Preview route: POST with an unknown or malformed id is 404/400 and sets no cookie, valid id sets an `HttpOnly; SameSite=lax; Path=/` cookie (Secure on https), DELETE clears it with `Max-Age=0`. `getTrendsForPage` (mock `auth` and `cookies` as `tests/trending-pages.test.tsx` and the themes tests do): visitor with a valid draft cookie gets only the published digest; non-admin signed-in user, same; admin with the cookie gets the draft's shown items and `previewing: true`; garbage cookie text and an unknown uuid are ignored; nothing published and no preview gives null; a published digest with no shown items gives null (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run tests/trend-admin-api.test.ts tests/trend-preview.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the routes and `getTrendsForPage`. `sourceLine` comes from `trendSourceLine` over the shown items' origins (de-duplicated, order web, pinterest, manual). `GET /api/admin/trends/[id]` returns `{ digest, matched: MatchedItem[] }` so the admin rows can show "We have 3 workshops".
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/lib/trend-preview.ts src/app/api/admin/trends tests/trend-admin-api.test.ts tests/trend-preview.test.ts && git commit -m "Market trends: admin API, publish and unpublish, preview cookie"`

### Task 7: Public block on /trending

**Files:**
- Create: `src/components/trends/TrendsBlock.tsx`, `src/components/trends/TrendsBlock.css`, `src/components/trends/TrendsPreviewBar.tsx`
- Modify: `src/app/trending/page.tsx`
- Test: `tests/trends-block.test.tsx`, `tests/trends-type-scale.test.ts`, extend `tests/trending-pages.test.tsx`

**Interfaces:**
- Consumes: `TrendsForPage` (Task 6), `trendBlockHeading`, `SITE.name`.
- Produces: `TrendsBlock({ data }: { data: TrendsForPage })` (server component); `TrendsPreviewBar()` (client; reuses the existing `.festive-preview` pill class from `globals.css`, text "Previewing market trends, not public yet", an **Exit** button that calls `DELETE /api/admin/trends/preview` then reloads, same as `ThemePreviewBar`).

- [ ] **Step 1: Write the failing tests.** Block: only craft items render under "Crafts to look at"; a craft plus an art item render under "Arts and crafts to look at"; workshop items render in a separate section headed "Workshops on the rise" and a block with no workshop items renders no workshop section; each card shows the title, why, tags as pills, `Source:` followed by the source titles (linked only when a url exists, with `rel="noopener noreferrer"`), and a link to `href` reading "See N pieces →" or "See N workshops →" (singular for 1), and for count 0 a muted "No artists listed yet" (crafts and art) or "Not offered yet" (workshops) with no link; text such as `<script>x</script>` appears escaped as text; the "Updated" line shows `updatedOn` as an IST date and the `sourceLine`; no card renders an `<img>` from a remote URL. Page test: with a published digest, `/trending` shows the block above the existing product grid, the product grid gets a heading `${SITE.name} picks`, and the existing h1 and grid are unchanged; with no digest the page renders exactly as before (existing tests keep passing, and no "picks" heading appears); with `previewing: true` the pill is present. Type-scale contract (pattern `tests/class-page-type-scale.test.ts`): in `TrendsBlock.css` card title is `500 18px var(--font-display)`, body 12px, notes 11px, eyebrow 9px with 2px spacing, section heading `500 clamp(22px, 2.4vw, 26px)`, no size above 26px or below 9px, no hex colour literals, and no `font-family` declaration or literal font name (fonts come from the inherited `--font-sans` and `--font-display`). Also run `npx vitest run tests/typography.test.ts` in this task and keep it green.
- [ ] **Step 2: Run** `npx vitest run tests/trends-block.test.tsx tests/trends-type-scale.test.ts tests/trending-pages.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the three components and the page change, reusing existing classes where they fit (`page-head`, `section`, `eyebrow`, `workshop-card` look, `ProductImage` is not used since there are no photos; the tile is a CSS pattern block from tokens). Grid `repeat(auto-fill, minmax(280px, 1fr))`, one column at 900px and below, tiles height-capped on phones. Call `getTrendsForPage()` in the page; render the pill only when `previewing`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/components/trends src/app/trending/page.tsx tests/trends-block.test.tsx tests/trends-type-scale.test.ts tests/trending-pages.test.tsx && git commit -m "Market trends: the block on /trending, with the preview pill for admins"`

### Task 8: Admin page

**Files:**
- Create: `src/app/dashboard/market-trends/page.tsx`, `src/components/MarketTrendsAdmin.tsx`
- Modify: `src/components/AdminTabs.tsx` (add `{ href: '/dashboard/market-trends', label: 'Market trends' }` right after Trending)
- Test: `tests/market-trends-page.test.tsx`

**Interfaces:**
- Consumes: Task 6 routes, `listDigests`, `getDigest`, `matchItems`, `Toast`, `PageLoader`, `trend-settings` (`getTrendSettings` to know whether a key is saved).
- Produces: page (server, `requireAdminPage()`, `noindex` like other dashboard pages, breadcrumbs Home, Dashboard, Market trends) rendering `MarketTrendsAdmin` with `{ digests, selected, matched, keySet }`; the selected digest comes from `?d=<id>`, default newest.

- [ ] **Step 1: Write the failing test** (render test in the style of `tests/fair-players-page.test.tsx`, mocked `fetch`): with no key saved, the page says so and links to `/dashboard/settings`, and "Fetch trends" is disabled; with no digests an empty state is shown; a draft digest card shows the badge "Draft", "Preview on site" and "Publish for everyone", a published one shows "Published" and "Unpublish" (a `danger-outline` button); Fetch is `aria-busy` while the request runs and a failure shows a toast; the items list has a Shown checkbox, a Kind select and Edit per row, and toggling Shown PATCHes the item; "Preview on site" POSTs `/api/admin/trends/preview` and shows the toast "Previewing the 24 November digest. Open /trending while signed in." (date from the digest); "Publish for everyone" is disabled when no item is shown; editing a published digest's items is disabled with the note "Unpublish to edit"; "+ Add an item by hand" opens a dialog (title, why, category, tags, kind, origin Pinterest or Manual research, source name and optional https link) that POSTs and shows the new row hidden; all controls have accessible names (`aria-label` with the digest date on card buttons).
- [ ] **Step 2: Run** `npx vitest run tests/market-trends-page.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** to match the admin board in the design, but built from the site's own classes and tokens as the Global Constraints require (no copied hex, font-family or sizes from the mockup): cards like the Themes admin (`admin-row-actions`, `badge published` and `badge draft`), controls at `--control-h`, selects use the global chevron, required fields use the `required` plus `.lbl` pattern, errors from the API shown in the dialog or a toast, pending states cleared in `finally`. Check the page at 390px, about 700px and 1280px by running it against the local dev DB only if the user has the dev server up; otherwise rely on the render tests and say so.
- [ ] **Step 4: Run** the same command. Expected: PASS; also `npx vitest run tests/admin-gate.test.tsx` PASS (new tab and page are admin only).
- [ ] **Step 5: Commit** `git add src/app/dashboard/market-trends src/components/MarketTrendsAdmin.tsx src/components/AdminTabs.tsx tests/market-trends-page.test.tsx && git commit -m "Market trends: the admin page, with preview on site and publish for everyone"`

### Task 9: Guards and full run

**Files:**
- Test: `tests/trends-no-hardcoded-names.test.ts`

- [ ] **Step 1: Write the test.** It reads every file this plan creates under `src/lib/trend-*.ts`, `src/components/trends/`, `src/components/MarketTrendsAdmin.tsx`, `src/components/TrendSettingsForm.tsx`, `src/app/dashboard/market-trends/` and fails if any contains `Rajasthan`, `Craftofy`, `Jaipur`, `Udaipur` or `Jodhpur` outside comments.
- [ ] **Step 2: Run** `npx vitest run tests/trends-no-hardcoded-names.test.ts`. Expected: PASS (it guards the earlier tasks; if it fails, fix the offending file).
- [ ] **Step 3: Run everything on Node 22:** `npx tsc --noEmit` (expected: no errors) and `npm test` (expected: all pass). Fix anything the new tab, schema or page broke.
- [ ] **Step 4: Manual check with a real key, local DB only** (needs the user's Gemini key; skip and say so if not provided): save the key in Settings, press Fetch, confirm items arrive with grounded sources, switch some on, Preview on site, open `/trending` signed in, then Exit, then confirm a signed-out window shows nothing, then Publish and confirm it shows, then Unpublish and confirm it is gone. Record the result in the PR description, not in code.
- [ ] **Step 5: Commit** `git add tests/trends-no-hardcoded-names.test.ts && git commit -m "Market trends: a guard against hardcoded place and brand names"`

---

## Self-review notes

- Spec coverage: Gemini key settings (Task 2), fetch and grounded sources (3), storage with `show`, `published_at`, `published_by`, single published row (1, 4), topic and product matching (4), manual fetch with lock and gap (5), items hand-added with Pinterest or manual origin (4, 8), admin-only routes and preview cookie (6), public block, headings by kind, hidden when empty, source credits, `${SITE.name} picks` heading (7), admin page and tab (8), no hardcoded names (9). Phase 2 (emails) and phase 3 (blog drafts) are out of scope by the spec.
- Left to the implementer: the Gemini model id (Task 2), the exact grounding host match after one live call (Task 3), prompt wording and item counts (Task 3), visual detail within the design skill (Tasks 7, 8).
- Decisions made here that the spec left open: edits are blocked on a published digest (409); fetch gap is 60 seconds; a failed fetch is stored as a `failed` row; craft and art counts use the best matching term among category and tags; the preview pill reuses `.festive-preview`.
