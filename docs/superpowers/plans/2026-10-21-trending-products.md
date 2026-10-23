# Trending Products (likes + engagement signals, one per artist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone like products, record unique views / contact clicks / artist-profile visits, and show a "Trending now" row (home page and `/trending`) ranked by a weighted mix of those signals, with at most one product per artist.

**Architecture:** Two small tables, `product_likes` (one row per product+actor) and `product_events` (one row per product+type+actor+day, so unique counts are bounded). Ranking is a pure function (`scoreSignals` + `pickDiverse`) fed by one aggregate query over the last 7 days, so the maths is unit-tested without a database. Public API routes record likes and events and serve the trending list; client components (`LikeButton`, `TrackOnMount`, `TrackedLink`) call them. Visitors need no account: likes use a random visitor cookie (or the user's email when signed in) and events use a salted per-day hash of IP + user agent, so no IP address is stored.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Postgres (PGlite in tests), Vitest + Testing Library. No new dependencies. Uses `gaEvent` from the GA4 plan (`docs/superpowers/plans/2026-10-21-ga4-analytics.md`, Task 1); if that plan has not been executed yet, create the minimal stub `export const gaEvent = (_n: string, _p?: Record<string, string | number | boolean>) => {}` in `src/lib/analytics.ts` and let the GA4 plan replace it.

**Spec:** No spec doc. Requirements = the user's message ("trending products (of different artists based on like functionality)") and answers: **anyone including anonymous visitors can like**; ranking is the **weighted mix from the user's second screenshot: views 35%, contact clicks 25%, artist-profile visits 20%, likes 20%**; **at most one product per artist** in the trending row.

## Environment facts

- Node 22: `export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH`. Run the full suite as `npx vitest run --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000`. Local Postgres: `npm run db:up` (settings in `.env.local`); real-database tests: `npm run test:pg`.
- The user edits the same working tree (rebrand: `Header.tsx`, `Hero.tsx`, `Footer.tsx`, `site.ts`, `globals.css`, `README.md`, `catalog.ts`, `LiveCatalog.tsx`, …). **Stage only files you created or fully own, by name; never `git add -A`; never commit `.env*` or `*.pem`.** For a shared file (`globals.css`, `README.md`) commit only if `git diff <file>` shows nothing but your change, otherwise leave it unstaged and say so in your final message. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push.
- Migrations: edit `src/db/schema.ts`, run `npx drizzle-kit generate --name <name>`, then `npm run db:migrate` (applies to the DB in `.env.local`). PGlite tests apply `drizzle/` automatically. The product query helper is `productsQuery(q)` in `src/db/mappers.ts`; public products come from `toProduct`, admin ones from `toAdminProduct`.
- `src/lib/hosts.ts` / `src/proxy.ts`: with two hosts, `/api/*` is served on both; the new public pages `/trending` and `/artists/*` belong to the public host and are redirected away from the dashboard host automatically.
- Existing design rules: `.claude/skills/rang-rajasthan-design/SKILL.md` (button/loader/toast patterns, `Breadcrumbs` on every page).

## Global Constraints

- Only **APPROVED (published)** products can be liked, counted or trend. Drafts/archived: like → `404 'Product not found.'`, events are ignored, never in results.
- A like is unique per (product, actor). Liking twice is idempotent; the count never double-counts. Actor = `u:<lower-cased email>` when signed in, else `v:<visitor cookie uuid>`.
- Visitor cookie `rr_vid`: random UUID v4, `HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000` (+ `Secure` on https). Set only by the like endpoints, never by page views.
- Events (`view`, `contact`, `artist`) store `actor = 'h:' + first 32 hex of sha256(day|ip|userAgent|salt)` (changes daily, unlinkable across days, no IP stored) and one row per (product, type, actor, UTC day). Known bots (empty/obvious crawler user agents) are ignored. Salt = `ANALYTICS_SALT`, falling back to `NEXTAUTH_SECRET`; never logged or returned.
- Write endpoints (`POST/DELETE /api/products/:id/like`, `POST /api/events`) require `Content-Type: application/json` (415 otherwise, which blocks cross-site form posts) and are rate limited: like 30/min per actor, events 120/min per IP; excess → `429 'Too many requests.'`.
- Trending: window = last **7 days** (events by UTC day, likes by timestamp). Signals per product: unique actors for `view`, `contact`, `artist`; likes in the window. Each signal is divided by the maximum of that signal across candidate products (0..1); `score = 0.35·views + 0.25·contact + 0.20·artist + 0.20·likes` (constants `WEIGHTS`). Products with no signal in the window are excluded. Sort by score desc, then window likes desc, then newer id first. Then keep **at most one product per artist** (the best one) and take the first `limit` (default 6, max 24).
- Public product JSON gains only `likeCount` (total likes) and `sellerSlug` (`<slugified name>-<first 8 hex of the seller id>`; the full seller id is never public). Nothing about actors, events or hashes is ever public.
- Artist pages list only published products; a seller with none gets a 404 (drafts are not enumerable). A `from=<productId>` visit counts as an `artist` event only when that product belongs to that artist.
- Empty trending → the home section is hidden; `/trending` shows "Nothing is trending yet. Like a product to start the trend."

## Review Focus

1. **Inflation / abuse:** repeated likes, cookie clearing, bots, a script hammering `/api/events`, cross-site POSTs, an `artist` event for someone else's product, events for draft products. (Tasks 2, 3, 5)
2. **Ranking correctness:** one runaway signal must not beat a balanced product incorrectly; division by zero when a signal is 0 everywhere; ties; the 7-day window edge; one-per-artist while still filling `limit`; unpublished products never leaking into results. (Task 3 pure + DB tests)
3. **Privacy leaks:** IP, user agent, salt, actor ids, visitor ids or seller uuids in any response or public page. (Tasks 2, 4, 6)
4. **Concurrency:** many simultaneous likes by the same actor (one row), by different actors (exact count), event dedupe under parallel writes. (Task 1 DB tests + Task 7 real-Postgres test)
5. **Empty/odd data:** no products, no signals, deleted product (cascade removes likes/events), seller with a single draft, a name that slugifies to empty, `limit` abuse (0, -1, 9999, "abc"). (Tasks 3, 4, 6)

---

## File Structure

```
src/db/schema.ts                         # + productLikes, productEvents
drizzle/0007_trending.sql (generated)    # migration
src/lib/rate-limit.ts                    # createLimiter(max, windowMs)
src/lib/actors.ts                        # cookie parsing, like actor, daily viewer hash, bot check, client ip
src/lib/engagement.ts                    # likeProduct/unlikeProduct/likeState/recordEvent
src/lib/trending.ts                      # WEIGHTS, scoreSignals, pickDiverse, trending()
src/lib/artists.ts                       # artistSlug, parseArtistSlug, getArtist()
src/db/mappers.ts, src/lib/types.ts      # + likeCount, sellerSlug on public products
src/app/api/products/[id]/like/route.ts  # POST/DELETE
src/app/api/likes/route.ts               # GET ?ids=
src/app/api/events/route.ts              # POST
src/app/api/trending/route.ts            # GET ?limit=
src/components/LikeButton.tsx, TrackOnMount.tsx, TrackedLink.tsx, TrendingSection.tsx
src/components/ProductCard.tsx           # + LikeButton
src/app/products/[slug]/page.tsx         # + LikeButton, view event, tracked contact links, artist link
src/app/artists/[slug]/page.tsx, src/app/trending/page.tsx
src/app/page.tsx, src/app/sitemap.ts     # + TrendingSection, + /trending and artists
src/app/globals.css                      # like button, artist page, trending styles
docs/trending.md, README.md
tests/{engagement,trending-score,trending,actors,rate-limit,engagement-api,trending-api,like-button,tracking,artists,trending-pages}.test.ts(x)
```

---

### Task 1: Tables, migration, likes and events (`engagement.ts`)

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0007_trending.sql` (generated), `src/lib/engagement.ts`, `tests/engagement.test.ts`
- Modify: `src/db/mappers.ts`, `src/lib/types.ts` (public `likeCount`)

**Interfaces:**
- Produces:
  - schema: `productLikes` (`productId`, `actor`, `createdAt`; PK `(productId, actor)`), `productEvents` (`id`, `productId`, `type`, `actor`, `day`, `createdAt`; unique `(productId, type, actor, day)`; check `type in ('view','contact','artist')`); both FK to `products.id` with `ON DELETE CASCADE`.
  - `type EventType = 'view' | 'contact' | 'artist'`
  - `likeProduct(productId: string, actor: string): Promise<{ liked: true; count: number }>` (404 if not a published product)
  - `unlikeProduct(productId: string, actor: string): Promise<{ liked: false; count: number }>` (404 if the product does not exist)
  - `likeState(ids: string[], actor?: string): Promise<{ counts: Record<string, number>; liked: string[] }>` (published products only; ids deduped, max 60)
  - `recordEvent(e: { productId: string; type: EventType; actor: string }, now?: Date): Promise<'recorded' | 'duplicate' | 'ignored'>`
  - `Product.likeCount?: number`, `Product.sellerSlug?: string` (set by `toProduct`)

- [ ] **Step 1: Write the failing tests** `tests/engagement.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { likeProduct, likeState, recordEvent, unlikeProduct } from '@/lib/engagement';
import { createProduct, deleteProduct, updateProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';
import { productEvents, productLikes } from '@/db/schema';
import { admin } from './helpers/actors';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const base = { name: 'Thing', category: 'Pottery', city: 'Jaipur', pricePaise: 100, description: 'D', stock: 1 };

describe('likes', () => {
  it('liking is idempotent per actor and counts distinct actors', async () => {
    expect(await likeProduct('p1', 'v:a')).toEqual({ liked: true, count: 1 });
    expect(await likeProduct('p1', 'v:a')).toEqual({ liked: true, count: 1 });
    expect(await likeProduct('p1', 'v:b')).toEqual({ liked: true, count: 2 });
    expect(await likeProduct('p1', 'u:me@x.co')).toEqual({ liked: true, count: 3 });
  });
  it('unliking removes only that actor\'s like and is idempotent', async () => {
    await likeProduct('p1', 'v:a'); await likeProduct('p1', 'v:b');
    expect(await unlikeProduct('p1', 'v:a')).toEqual({ liked: false, count: 1 });
    expect(await unlikeProduct('p1', 'v:a')).toEqual({ liked: false, count: 1 });
  });
  it('only published products can be liked; unknown or draft ids are 404', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ ...base, status: 'DRAFT', sellerId: s.id }, admin);
    await expect(likeProduct(draft.id, 'v:a')).rejects.toMatchObject({ status: 404, message: 'Product not found.' });
    await expect(likeProduct('nope', 'v:a')).rejects.toMatchObject({ status: 404 });
    await expect(unlikeProduct('nope', 'v:a')).rejects.toMatchObject({ status: 404 });
    expect(await (await getTestDb()).select().from(productLikes)).toHaveLength(0);
  });
  it('likeState returns counts for published products and which ones this actor liked; odd ids are ignored', async () => {
    await likeProduct('p1', 'v:a'); await likeProduct('p1', 'v:b'); await likeProduct('p2', 'v:a');
    const s = await likeState(['p1', 'p2', 'p3', 'p1', 'bogus', ''], 'v:a');
    expect(s.counts).toEqual({ p1: 2, p2: 1, p3: 0 });
    expect(s.liked.sort()).toEqual(['p1', 'p2']);
    expect((await likeState(['p1'])).liked).toEqual([]);          // no actor
    expect(Object.keys((await likeState(Array.from({ length: 200 }, (_, i) => `p${i}`))).counts).length).toBeLessThanOrEqual(60);
  });
  it('the public product JSON carries likeCount and sellerSlug but no actor data', async () => {
    await likeProduct('p1', 'v:secret-visitor'); await likeProduct('p1', 'u:private@x.co');
    const p = (await listProducts()).find(x => x.id === 'p1')!;
    expect(p.likeCount).toBe(2);
    expect(p.sellerSlug).toMatch(/^shauk-and-stuff-[0-9a-f]{8}$/);
    const json = JSON.stringify(p);
    for (const secret of ['secret-visitor', 'private@x.co', 'actor']) expect(json).not.toContain(secret);
    expect((await listProducts()).find(x => x.id === 'p4')!.likeCount).toBe(0);
  });
  it('deleting a product removes its likes and events', async () => {
    await likeProduct('p1', 'v:a'); await recordEvent({ productId: 'p1', type: 'view', actor: 'h:x' });
    await deleteProduct('p1');
    const db = await getTestDb();
    expect(await db.select().from(productLikes)).toHaveLength(0);
    expect(await db.select().from(productEvents)).toHaveLength(0);
  });
  it('concurrent likes: same actor many times = one row, different actors = exact count', async () => {
    await Promise.all(Array.from({ length: 20 }, () => likeProduct('p1', 'v:same')));
    expect((await likeState(['p1'])).counts.p1).toBe(1);
    await Promise.all(Array.from({ length: 25 }, (_, i) => likeProduct('p2', `v:${i}`)));
    expect((await likeState(['p2'])).counts.p2).toBe(25);
  });
});

describe('events', () => {
  const day = (iso: string) => new Date(iso);
  it('records one row per product+type+actor+UTC day; repeats are duplicates; a new day or type is new', async () => {
    const e = { productId: 'p1', type: 'view' as const, actor: 'h:a' };
    expect(await recordEvent(e, day('2026-10-20T10:00:00Z'))).toBe('recorded');
    expect(await recordEvent(e, day('2026-10-20T23:59:59Z'))).toBe('duplicate');
    expect(await recordEvent(e, day('2026-10-21T00:00:01Z'))).toBe('recorded');
    expect(await recordEvent({ ...e, type: 'contact' }, day('2026-10-20T10:00:00Z'))).toBe('recorded');
    expect(await recordEvent({ ...e, actor: 'h:b' }, day('2026-10-20T10:00:00Z'))).toBe('recorded');
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(4);
  });
  it('events for unknown, draft or archived products are ignored (nothing written)', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ ...base, status: 'DRAFT', sellerId: s.id }, admin);
    const archived = await createProduct({ ...base, status: 'APPROVED', sellerId: s.id }, admin);
    await updateProduct(archived.id, { status: 'ARCHIVED' }, admin);
    for (const id of [draft.id, archived.id, 'nope']) expect(await recordEvent({ productId: id, type: 'view', actor: 'h:a' })).toBe('ignored');
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(0);
  });
  it('the database refuses an unknown event type, and parallel identical events leave one row', async () => {
    const db = await getTestDb();
    await expect(db.insert(productEvents).values({ productId: 'p1', type: 'purchase', actor: 'h:a', day: '2026-10-20' })).rejects.toThrow();
    const rs = await Promise.all(Array.from({ length: 15 }, () => recordEvent({ productId: 'p2', type: 'view', actor: 'h:same' }, new Date('2026-10-20T10:00:00Z'))));
    expect(rs.filter(r => r === 'recorded')).toHaveLength(1);
    expect((await db.select().from(productEvents).where(eq(productEvents.productId, 'p2')))).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/engagement.test.ts` → FAIL (module/tables missing).

- [ ] **Step 3: Schema + migration.** In `src/db/schema.ts` (imports: add `bigserial`, `date`):

```ts
export const productLikes = pgTable('product_likes', {
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.productId, t.actor] }), index('product_likes_created_idx').on(t.createdAt)]);

export const productEvents = pgTable('product_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  actor: text('actor').notNull(),
  day: date('day', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('product_events_type_valid', sql`${t.type} in ('view', 'contact', 'artist')`),
  uniqueIndex('product_events_unique_idx').on(t.productId, t.type, t.actor, t.day),
  index('product_events_day_idx').on(t.day),
]);
```
Run `npx drizzle-kit generate --name trending` (expect `drizzle/0007_trending.sql` with two `CREATE TABLE`, the check, indexes and two cascade FKs; open it and confirm). `truncateAll` already uses `cascade`, which also empties these tables.

- [ ] **Step 4: `src/lib/engagement.ts`:**

```ts
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productEvents, productLikes, products } from '../db/schema';
import { ApiError } from './errors';

export type EventType = 'view' | 'contact' | 'artist';
const NOT_FOUND = () => new ApiError(404, 'Product not found.');
const MAX_IDS = 60;

async function publishedStatus(id: string): Promise<'APPROVED' | 'OTHER' | 'MISSING'> {
  const [row] = await getDb().select({ status: products.status }).from(products).where(eq(products.id, id));
  return !row ? 'MISSING' : row.status === 'APPROVED' ? 'APPROVED' : 'OTHER';
}
const likeCount = async (id: string) => (await getDb().select({ n: count() }).from(productLikes).where(eq(productLikes.productId, id)))[0].n;

export async function likeProduct(productId: string, actor: string): Promise<{ liked: true; count: number }> {
  if ((await publishedStatus(productId)) !== 'APPROVED') throw NOT_FOUND();
  await getDb().insert(productLikes).values({ productId, actor }).onConflictDoNothing();
  return { liked: true, count: await likeCount(productId) };
}

export async function unlikeProduct(productId: string, actor: string): Promise<{ liked: false; count: number }> {
  if ((await publishedStatus(productId)) === 'MISSING') throw NOT_FOUND();
  await getDb().delete(productLikes).where(and(eq(productLikes.productId, productId), eq(productLikes.actor, actor)));
  return { liked: false, count: await likeCount(productId) };
}

export async function likeState(ids: string[], actor?: string): Promise<{ counts: Record<string, number>; liked: string[] }> {
  const wanted = [...new Set(ids.filter(i => /^p\d+$/.test(i)))].slice(0, MAX_IDS);
  if (!wanted.length) return { counts: {}, liked: [] };
  const db = getDb();
  const rows = await db.select({
    id: products.id,
    n: sql<number>`(select count(*) from product_likes l where l.product_id = ${products.id})`.mapWith(Number),
    mine: actor ? sql<boolean>`exists (select 1 from product_likes l where l.product_id = ${products.id} and l.actor = ${actor})` : sql<boolean>`false`,
  }).from(products).where(and(inArray(products.id, wanted), eq(products.status, 'APPROVED')));
  return { counts: Object.fromEntries(rows.map(r => [r.id, r.n])), liked: rows.filter(r => r.mine).map(r => r.id) };
}

export async function recordEvent(e: { productId: string; type: EventType; actor: string }, now = new Date()): Promise<'recorded' | 'duplicate' | 'ignored'> {
  if ((await publishedStatus(e.productId)) !== 'APPROVED') return 'ignored';
  const day = now.toISOString().slice(0, 10);
  const rows = await getDb().insert(productEvents).values({ productId: e.productId, type: e.type, actor: e.actor, day }).onConflictDoNothing().returning({ id: productEvents.id });
  return rows.length ? 'recorded' : 'duplicate';
}
```
Public product fields: in `src/lib/types.ts` add to `Product`: `likeCount?: number; sellerSlug?: string;`. In `src/db/mappers.ts` add to `productSelect`: `sellerId: products.sellerId` is already inside `p`; add `likeCount: sql<number>\`(select count(*) from product_likes pl where pl.product_id = ${products.id})\`.mapWith(Number)`; extend `ProductJoinRow` with `likeCount: number`; in `toProduct` add `likeCount: r.likeCount, sellerSlug: artistSlug(r.sellerName, r.p.sellerId)` where `artistSlug` is exported from a new tiny file `src/lib/artist-slug.ts` (pure, client-safe):

```ts
import { slugify } from './slug';
/** "<name>-<first 8 hex of the seller id>": identifies an artist page without exposing the full id. */
export const artistSlug = (name: string, sellerId: string) => `${slugify(name) || 'artist'}-${sellerId.replace(/-/g, '').slice(0, 8).toLowerCase()}`;
export const artistIdPrefix = (slug: string) => /-([0-9a-f]{8})$/.exec(slug)?.[1];
```
(`toAdminProduct` spreads `toProduct`, so admin JSON gets them too; fine.) Update any test that deep-equals a whole public product to use `toMatchObject` (run the suite and fix only such failures).

- [ ] **Step 5: Run to verify GREEN** — `npx vitest run tests/engagement.test.ts`, then the whole suite and `npx tsc --noEmit`. Apply the migration to the local DB: `npm run db:migrate`.
  Mutation checks (revert after): remove `.onConflictDoNothing()` in `likeProduct` → the idempotency/concurrency tests FAIL; drop the `APPROVED` guard in `recordEvent` → the draft test FAILS.

- [ ] **Step 6: Commit**
```bash
git add src/db/schema.ts drizzle/0007_trending.sql drizzle/meta src/lib/engagement.ts src/lib/artist-slug.ts src/db/mappers.ts src/lib/types.ts tests/engagement.test.ts
git commit -m "feat: product likes and unique-per-day engagement events (tables, migration, engagement lib)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Actors, bot filter and rate limiter

**Files:**
- Create: `src/lib/actors.ts`, `src/lib/rate-limit.ts`, `tests/actors.test.ts`, `tests/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `VISITOR_COOKIE = 'rr_vid'`, `newVisitorId(): string`, `isVisitorId(v: unknown): v is string`, `readCookie(header: string | null, name: string): string | undefined`, `visitorCookie(id: string, secure: boolean): string` (the `Set-Cookie` value)
  - `likeActor(opts: { email?: string | null; visitorId: string }): string`
  - `clientIp(h: { get(name: string): string | null }): string`, `isBot(userAgent: string | null): boolean`
  - `viewerActor(opts: { ip: string; userAgent: string; now?: Date; salt?: string }): string`
  - `createLimiter(max: number, windowMs: number): { hit(key: string, now?: number): boolean }` (true = allowed)

- [ ] **Step 1: Write the failing tests.**

`tests/actors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { VISITOR_COOKIE, clientIp, isBot, isVisitorId, likeActor, newVisitorId, readCookie, viewerActor, visitorCookie } from '@/lib/actors';

const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });

describe('visitor cookie', () => {
  it('generates uuid v4 ids and validates them strictly', () => {
    const id = newVisitorId();
    expect(isVisitorId(id)).toBe(true);
    for (const bad of ['', 'abc', id + 'x', id.toUpperCase().replace(/-/g, ''), '../../etc', 5, null, undefined]) expect(isVisitorId(bad)).toBe(false);
  });
  it('reads one named cookie out of a Cookie header, tolerating spacing and encoded values', () => {
    expect(readCookie('a=1; rr_vid=abc; b=2', 'rr_vid')).toBe('abc');
    expect(readCookie('rr_vid=abc', 'rr_vid')).toBe('abc');
    expect(readCookie('xrr_vid=nope; rr_vid2=nope', 'rr_vid')).toBeUndefined();
    expect(readCookie(null, 'rr_vid')).toBeUndefined();
    expect(readCookie('rr_vid=a%20b', 'rr_vid')).toBe('a b');
  });
  it('builds a safe Set-Cookie: HttpOnly, SameSite=Lax, one year, Secure only on https', () => {
    const id = newVisitorId();
    const c = visitorCookie(id, true);
    expect(c).toBe(`${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`);
    expect(visitorCookie(id, false)).not.toContain('Secure');
  });
});

describe('likeActor', () => {
  it('signed-in users are identified by lower-cased email, everyone else by visitor id', () => {
    expect(likeActor({ email: 'Me@X.co', visitorId: 'v1' })).toBe('u:me@x.co');
    expect(likeActor({ email: null, visitorId: 'v1' })).toBe('v:v1');
    expect(likeActor({ email: '  ', visitorId: 'v1' })).toBe('v:v1');
  });
});

describe('clientIp / isBot', () => {
  it('takes the first x-forwarded-for hop, then x-real-ip, else "unknown"', () => {
    expect(clientIp(h({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientIp(h({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(h({}))).toBe('unknown');
  });
  it('flags crawlers, tools and empty user agents but not browsers', () => {
    for (const ua of ['Googlebot/2.1', 'bingbot', 'facebookexternalhit/1.1', 'curl/8.0', 'python-requests/2', 'HeadlessChrome/120', 'Lighthouse', 'AhrefsBot', '', null]) expect(isBot(ua as string | null)).toBe(true);
    for (const ua of ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148']) expect(isBot(ua)).toBe(false);
  });
});

describe('viewerActor (privacy-friendly daily hash)', () => {
  const base = { ip: '1.2.3.4', userAgent: 'UA', salt: 'pepper' };
  it('is stable within a UTC day and different the next day, for another ip/ua, or another salt', () => {
    const a = viewerActor({ ...base, now: new Date('2026-10-20T01:00:00Z') });
    expect(a).toMatch(/^h:[0-9a-f]{32}$/);
    expect(viewerActor({ ...base, now: new Date('2026-10-20T23:00:00Z') })).toBe(a);
    for (const other of [{ now: new Date('2026-10-21T01:00:00Z') }, { ip: '1.2.3.5' }, { userAgent: 'UB' }, { salt: 'other' }])
      expect(viewerActor({ ...base, now: new Date('2026-10-20T01:00:00Z'), ...other })).not.toBe(a);
  });
  it('never contains the ip or user agent', () => {
    const a = viewerActor({ ip: '203.0.113.77', userAgent: 'SecretAgent/1', salt: 's' });
    expect(a).not.toContain('203'); expect(a.toLowerCase()).not.toContain('secretagent');
  });
});
```
`tests/rate-limit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createLimiter } from '@/lib/rate-limit';

describe('createLimiter', () => {
  it('allows max hits per window per key, then blocks, then recovers when the window passes', () => {
    const l = createLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => l.hit('a', 0))).toEqual([true, true, true, false]);
    expect(l.hit('b', 0)).toBe(true);                 // other keys are independent
    expect(l.hit('a', 999)).toBe(false);
    expect(l.hit('a', 1001)).toBe(true);
  });
  it('blocked attempts do not extend the block, and memory stays bounded for many keys', () => {
    const l = createLimiter(1, 1000);
    l.hit('a', 0); for (let i = 0; i < 50; i++) l.hit('a', 500);
    expect(l.hit('a', 1001)).toBe(true);
    for (let i = 0; i < 20_000; i++) l.hit(`k${i}`, 2000);
    expect(l.size()).toBeLessThanOrEqual(10_000);
  });
});
```
(add `size(): number` to the interface.)

- [ ] **Step 2: Run to verify RED.**

- [ ] **Step 3: Implement.**
`src/lib/rate-limit.ts`:
```ts
/** Sliding-window limiter kept in memory (per process). Fine for one container; use a shared store if you scale out. */
export function createLimiter(max: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
      const allowed = recent.length < max;
      if (allowed) recent.push(now);
      hits.delete(key); hits.set(key, recent);          // keep insertion order = recency
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
      return allowed;
    },
    size: () => hits.size,
  };
}
```
`src/lib/actors.ts`:
```ts
import crypto from 'node:crypto';

export const VISITOR_COOKIE = 'rr_vid';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const newVisitorId = () => crypto.randomUUID();
export const isVisitorId = (v: unknown): v is string => typeof v === 'string' && UUID_V4.test(v);

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return undefined; } }
  }
  return undefined;
}
export const visitorCookie = (id: string, secure: boolean) =>
  `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

export const likeActor = ({ email, visitorId }: { email?: string | null; visitorId: string }) =>
  email && email.trim() ? `u:${email.trim().toLowerCase()}` : `v:${visitorId}`;

export function clientIp(h: { get(name: string): string | null }): string {
  const xff = h.get('x-forwarded-for')?.split(',')[0].trim();
  return xff || h.get('x-real-ip')?.trim() || 'unknown';
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|lighthouse|pagespeed|python-requests|curl|wget|httpclient|monitor|uptime|preview/i;
export const isBot = (ua: string | null | undefined) => !ua || !ua.trim() || BOT.test(ua);

/** One value per visitor per UTC day. Salted and hashed: the ip and user agent are never stored and cannot be linked across days. */
export function viewerActor({ ip, userAgent, now = new Date(), salt = process.env.ANALYTICS_SALT ?? process.env.NEXTAUTH_SECRET ?? 'dev-only-salt' }: { ip: string; userAgent: string; now?: Date; salt?: string }): string {
  const day = now.toISOString().slice(0, 10);
  return 'h:' + crypto.createHash('sha256').update(`${day}|${ip}|${userAgent}|${salt}`).digest('hex').slice(0, 32);
}
```

- [ ] **Step 4: Run to verify GREEN** — both files, then `npx tsc --noEmit`. Mutation (revert after): make `viewerActor` ignore the day → the day test FAILS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/actors.ts src/lib/rate-limit.ts tests/actors.test.ts tests/rate-limit.test.ts
git commit -m "feat: visitor/viewer actors, bot filter and rate limiter for engagement tracking

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Trending ranking (`trending.ts`)

**Files:**
- Create: `src/lib/trending.ts`, `tests/trending-score.test.ts`, `tests/trending.test.ts`

**Interfaces:**
- Consumes: Task 1 tables, `productsQuery`, `toProduct`.
- Produces:
  - `WEIGHTS = { views: 0.35, contact: 0.25, artist: 0.2, likes: 0.2 } as const`, `WINDOW_DAYS = 7`
  - `type Signals = { productId: string; sellerId: string; views: number; contact: number; artist: number; likes: number }`
  - `scoreSignals(rows: Signals[]): (Signals & { score: number })[]` (sorted; zero-signal rows dropped)
  - `pickDiverse<T extends { sellerId: string }>(sorted: T[], limit: number, perArtist?: number): T[]`
  - `trending(opts?: { limit?: number; now?: Date }): Promise<Product[]>` (published only, one per artist, ordered best first; `limit` clamped to 1..24, default 6)

- [ ] **Step 1: Write the failing tests.**

`tests/trending-score.test.ts` (pure, no DB):
```ts
import { describe, it, expect } from 'vitest';
import { WEIGHTS, pickDiverse, scoreSignals, type Signals } from '@/lib/trending';

const s = (id: string, seller: string, v = 0, c = 0, a = 0, l = 0): Signals => ({ productId: id, sellerId: seller, views: v, contact: c, artist: a, likes: l });

describe('scoreSignals', () => {
  it('weights are the agreed mix and sum to 1', () => {
    expect(WEIGHTS).toEqual({ views: 0.35, contact: 0.25, artist: 0.2, likes: 0.2 });
    expect(Object.values(WEIGHTS).reduce((x, y) => x + y, 0)).toBeCloseTo(1, 10);
  });
  it('normalises each signal by its own maximum and applies the weights', () => {
    const out = scoreSignals([s('p1', 'a', 10, 0, 0, 0), s('p2', 'b', 5, 4, 2, 10), s('p3', 'c', 0, 4, 2, 0)]);
    const by = Object.fromEntries(out.map(r => [r.productId, r.score]));
    expect(by.p1).toBeCloseTo(0.35 * 1, 10);                                      // best on views only
    expect(by.p2).toBeCloseTo(0.35 * 0.5 + 0.25 * 1 + 0.2 * 1 + 0.2 * 1, 10);     // balanced
    expect(by.p3).toBeCloseTo(0.25 * 1 + 0.2 * 1, 10);
    expect(out.map(r => r.productId)).toEqual(['p2', 'p1', 'p3']);                  // balanced beats one-signal
  });
  it('a signal that is zero for everyone does not divide by zero or distort the others', () => {
    const out = scoreSignals([s('p1', 'a', 4, 0, 0, 0), s('p2', 'b', 2, 0, 0, 0)]);
    expect(out.map(r => [r.productId, r.score])).toEqual([['p1', 0.35], ['p2', 0.175]]);
    expect(out.every(r => Number.isFinite(r.score))).toBe(true);
  });
  it('drops products with no signal at all; empty input gives empty output', () => {
    expect(scoreSignals([s('p1', 'a'), s('p2', 'b')])).toEqual([]);
    expect(scoreSignals([])).toEqual([]);
    expect(scoreSignals([s('p1', 'a'), s('p2', 'b', 1)]).map(r => r.productId)).toEqual(['p2']);
  });
  it('ties: more likes first, then the newer (higher numeric) id', () => {
    const out = scoreSignals([s('p2', 'a', 1, 0, 0, 0), s('p10', 'b', 1, 0, 0, 0)]);
    expect(out.map(r => r.productId)).toEqual(['p10', 'p2']);                       // p10 is newer than p2 (numeric, not text)
    const likes = scoreSignals([s('p1', 'a', 0, 0, 0, 2), s('p9', 'b', 0, 0, 0, 2), s('p5', 'c', 0, 0, 0, 2)]);
    expect(likes.map(r => r.productId)).toEqual(['p9', 'p5', 'p1']);
  });
});

describe('pickDiverse', () => {
  const sorted = [s('p1', 'a'), s('p2', 'a'), s('p3', 'b'), s('p4', 'c'), s('p5', 'b'), s('p6', 'd')];
  it('keeps the best product of each artist and fills up to the limit', () => {
    expect(pickDiverse(sorted, 3).map(r => r.productId)).toEqual(['p1', 'p3', 'p4']);
    expect(pickDiverse(sorted, 10).map(r => r.productId)).toEqual(['p1', 'p3', 'p4', 'p6']);   // fewer artists than the limit: no padding with repeats
  });
  it('perArtist=2 allows a second product per artist, never a third', () => {
    expect(pickDiverse(sorted, 10, 2).map(r => r.productId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(pickDiverse([s('p1', 'a'), s('p2', 'a'), s('p3', 'a')], 10, 2).map(r => r.productId)).toEqual(['p1', 'p2']);
  });
  it('limit 0 or negative gives nothing; input order is preserved', () => {
    expect(pickDiverse(sorted, 0)).toEqual([]);
    expect(pickDiverse(sorted, -3)).toEqual([]);
  });
});
```
`tests/trending.test.ts` (DB; uses `recordEvent`, `likeProduct`, and direct inserts to control timestamps):
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { trending } from '@/lib/trending';
import { likeProduct, recordEvent } from '@/lib/engagement';
import { createProduct, updateProduct } from '@/lib/admin';
import { productLikes } from '@/db/schema';
import { admin } from './helpers/actors';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

const NOW = new Date('2026-10-21T12:00:00Z');
beforeEach(async () => { await resetTestDb(); });
const ids = async (o: { limit?: number } = {}) => (await trending({ ...o, now: NOW })).map(p => p.id);
const view = (productId: string, actor: string, at = '2026-10-20T10:00:00Z') => recordEvent({ productId, type: 'view', actor }, new Date(at));

describe('trending()', () => {
  it('is empty when nothing has any activity', async () => { expect(await ids()).toEqual([]); });
  it('ranks by the weighted mix and returns public products with like counts', async () => {
    for (const a of ['h:1', 'h:2', 'h:3']) await view('p1', a);                 // p1: 3 views
    await view('p2', 'h:1');                                                    // p2: 1 view ...
    await recordEvent({ productId: 'p2', type: 'contact', actor: 'h:1' }, new Date('2026-10-20T10:00:00Z'));
    await recordEvent({ productId: 'p2', type: 'artist', actor: 'h:1' }, new Date('2026-10-20T10:00:00Z'));
    await likeProduct('p2', 'v:a'); await likeProduct('p2', 'v:b');             // ... + contact + artist + 2 likes
    const out = await trending({ now: NOW });
    expect(out.map(p => p.id)).toEqual(['p2', 'p1']);                           // 0.35/3 + .25 + .2 + .2 = .767 > .35
    expect(out[0]).toMatchObject({ name: 'Pichola Boat Bag Charm', likeCount: 2 });
    expect(out[0]).not.toHaveProperty('sellerId');
  });
  it('counts unique people: the same visitor on several days is several day-rows but one person', async () => {
    await view('p1', 'h:same', '2026-10-18T10:00:00Z'); await view('p1', 'h:same', '2026-10-19T10:00:00Z'); await view('p1', 'h:same', '2026-10-20T10:00:00Z');
    await view('p2', 'h:x'); await view('p2', 'h:y');
    expect(await ids()).toEqual(['p2', 'p1']);                                  // 2 unique people beat 1 person on 3 days
  });
  it('only the last 7 days count: older events and likes are ignored', async () => {
    await view('p1', 'h:a', '2026-10-10T10:00:00Z');                           // 11 days old
    await view('p1', 'h:b', '2026-10-14T10:00:00Z');                           // 7 days old: day 2026-10-14 is outside the 7-day window ending 2026-10-21 (21..15)
    expect(await ids()).toEqual([]);
    await view('p3', 'h:c', '2026-10-15T00:00:01Z');                           // inside
    expect(await ids()).toEqual(['p3']);
    const db = await getTestDb();
    await likeProduct('p4', 'v:old');
    await db.update(productLikes).set({ createdAt: new Date('2026-10-01T00:00:00Z') }).where(eq(productLikes.productId, 'p4'));
    expect(await ids()).toEqual(['p3']);
  });
  it('shows at most one product per artist (their best), even if one artist has the top three', async () => {
    const s = await makeSeller('star@x.co', 'Star Artist');
    const mk = async (name: string) => (await createProduct({ name, category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin)).id;
    const [a, b, c] = [await mk('Star A'), await mk('Star B'), await mk('Star C')];
    for (const [pid, n] of [[a, 5], [b, 4], [c, 3]] as const) for (let i = 0; i < n; i++) await view(pid, `h:${pid}${i}`);
    await view('p1', 'h:solo'); await view('p2', 'h:solo2');
    const out = await ids();
    expect(out.filter(x => [a, b, c].includes(x))).toEqual([a]);
    expect(out).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(out).toHaveLength(3);
  });
  it('respects the limit (default 6, clamped to 1..24) and ignores nonsense', async () => {
    const s = await makeSeller('many@x.co', 'Many');
    for (let i = 0; i < 30; i++) { const m = await makeSeller(`m${i}@x.co`, `Maker ${i}`); const p = await createProduct({ name: `P${i}`, category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: m.id }, admin); await view(p.id, `h:${i}`); }
    void s;
    expect((await ids()).length).toBe(6);
    expect((await ids({ limit: 3 })).length).toBe(3);
    expect((await ids({ limit: 999 })).length).toBe(24);
    for (const limit of [0, -5, Number.NaN]) expect((await ids({ limit: limit as number })).length).toBeGreaterThanOrEqual(1);
  });
  it('unpublished products never appear, even with plenty of old activity', async () => {
    await view('p1', 'h:a'); await likeProduct('p1', 'v:a');
    await updateProduct('p1', { status: 'ARCHIVED' }, admin);
    expect(await ids()).toEqual([]);
    await updateProduct('p1', { status: 'DRAFT' }, admin);
    expect(await ids()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify RED.**

- [ ] **Step 3: Implement `src/lib/trending.ts`:**

```ts
import { eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { products } from '../db/schema';
import type { Product } from './types';

export const WEIGHTS = { views: 0.35, contact: 0.25, artist: 0.2, likes: 0.2 } as const;
export const WINDOW_DAYS = 7;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 24;

export type Signals = { productId: string; sellerId: string; views: number; contact: number; artist: number; likes: number };
const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

/** Max-normalise each signal to 0..1, apply WEIGHTS, drop products with no signal, sort best first. */
export function scoreSignals(rows: Signals[]): (Signals & { score: number })[] {
  const max = (k: keyof typeof WEIGHTS) => Math.max(0, ...rows.map(r => r[k]));
  const m = { views: max('views'), contact: max('contact'), artist: max('artist'), likes: max('likes') };
  return rows
    .filter(r => r.views + r.contact + r.artist + r.likes > 0)
    .map(r => ({ ...r, score: (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + (m[k] ? (r[k] / m[k]) * WEIGHTS[k] : 0), 0) }))
    .sort((a, b) => b.score - a.score || b.likes - a.likes || idNum(b.productId) - idNum(a.productId));
}

/** Keeps the best `perArtist` products of every artist, preserving order, up to `limit`. */
export function pickDiverse<T extends { sellerId: string }>(sorted: T[], limit: number, perArtist = 1): T[] {
  const seen = new Map<string, number>();
  const out: T[] = [];
  for (const r of sorted) {
    if (out.length >= limit) break;
    const n = seen.get(r.sellerId) ?? 0;
    if (n >= perArtist) continue;
    seen.set(r.sellerId, n + 1);
    out.push(r);
  }
  return out;
}

export async function trending({ limit = DEFAULT_LIMIT, now = new Date() }: { limit?: number; now?: Date } = {}): Promise<Product[]> {
  const n = Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))) : DEFAULT_LIMIT;
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const firstDay = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000).toISOString().slice(0, 10); // the last 7 UTC days, today included
  const distinct = (type: string) => sql<number>`(select count(distinct e.actor) from product_events e where e.product_id = ${products.id} and e.type = ${type} and e.day >= ${firstDay})`.mapWith(Number);
  const db = getDb();
  const rows = await db.select({
    productId: products.id, sellerId: products.sellerId,
    views: distinct('view'), contact: distinct('contact'), artist: distinct('artist'),
    likes: sql<number>`(select count(*) from product_likes l where l.product_id = ${products.id} and l.created_at >= ${since})`.mapWith(Number),
  }).from(products).where(eq(products.status, 'APPROVED'));
  const picked = pickDiverse(scoreSignals(rows), n);
  if (!picked.length) return [];
  const full = await productsQuery(db).where(inArray(products.id, picked.map(p => p.productId)));
  const byId = new Map(full.map(r => [r.p.id, toProduct(r)]));
  return picked.map(p => byId.get(p.productId)!).filter(Boolean);
}
```
(The test "limit nonsense" expects `limit` 0, -5, NaN to behave: 0 and -5 clamp to 1, NaN falls back to the default 6.)

- [ ] **Step 4: Run to verify GREEN** — both files, whole suite, `npx tsc --noEmit`. Mutations (revert after): change `WINDOW_DAYS` to 30 → the window test FAILS; remove `pickDiverse` from `trending` → the one-per-artist test FAILS; use `count(e.actor)` instead of `count(distinct e.actor)` → the unique-people test FAILS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/trending.ts tests/trending-score.test.ts tests/trending.test.ts
git commit -m "feat: trending ranking (weighted signals, 7-day window, one product per artist)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: API routes (like, likes, events, trending)

**Files:**
- Create: `src/app/api/products/[id]/like/route.ts`, `src/app/api/likes/route.ts`, `src/app/api/events/route.ts`, `src/app/api/trending/route.ts`, `tests/engagement-api.test.ts`, `tests/trending-api.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`likeProduct`, `unlikeProduct`, `likeState`, `recordEvent`, `trending`), `actors.ts`, `rate-limit.ts`, `auth()` from `@/auth`, `handle`/`json` from `@/lib/api`.
- Produces (HTTP):
  - `POST /api/products/:id/like` and `DELETE` → `200 { liked: boolean, count: number }`, sets `rr_vid` cookie when the visitor had none; `415` without JSON content type; `404` unknown/unpublished; `429` over 30/min per actor.
  - `GET /api/likes?ids=p1,p2` → `200 { counts, liked }` (`no-store`; max 60 ids; bad ids ignored).
  - `POST /api/events` body `{ type: 'view'|'contact'|'artist', productId }` → `204`; `400` bad body/type/id; `415`; `429` over 120/min per IP; bots → `204` without writing.
  - `GET /api/trending?limit=` → `200 Product[]`, `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.

- [ ] **Step 1: Write the failing tests.**

`tests/engagement-api.test.ts` (mock `@/auth`; use real `resetTestDb`):
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
import { POST as likePost, DELETE as likeDelete } from '@/app/api/products/[id]/like/route';
import { GET as likesGet } from '@/app/api/likes/route';
import { POST as eventsPost } from '@/app/api/events/route';
import { resetLimitersForTests } from '@/lib/engagement-limits';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { productEvents, productLikes } from '@/db/schema';
import { createProduct } from '@/lib/admin';
import { admin } from './helpers/actors';

const VID = 'b3d9f2c0-5a1e-4c2b-9d3e-7f6a8b9c0d1e';
const JSON_H = { 'content-type': 'application/json' };
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const like = (id: string, headers: Record<string, string> = JSON_H, method: 'POST' | 'DELETE' = 'POST') =>
  (method === 'POST' ? likePost : likeDelete)(new Request(`http://x/api/products/${id}/like`, { method, headers, body: '{}' }), ctx(id));
const event = (body: unknown, headers: Record<string, string> = { ...JSON_H, 'user-agent': BROWSER, 'x-forwarded-for': '1.2.3.4' }) =>
  eventsPost(new Request('http://x/api/events', { method: 'POST', headers, body: JSON.stringify(body) }));

beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); resetLimitersForTests(); await resetTestDb(); });

describe('POST/DELETE /api/products/:id/like', () => {
  it('an anonymous visitor can like: the first call sets a visitor cookie, the second (with the cookie) is the same like', async () => {
    const r1 = await like('p1');
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ liked: true, count: 1 });
    const cookie = r1.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^rr_vid=[0-9a-f-]{36}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax/);
    const vid = /rr_vid=([^;]+)/.exec(cookie)![1];
    const r2 = await like('p1', { ...JSON_H, cookie: `rr_vid=${vid}` });
    expect(await r2.json()).toEqual({ liked: true, count: 1 });
    expect(r2.headers.get('set-cookie')).toBeNull();                       // already has one
    const unlike = await like('p1', { ...JSON_H, cookie: `rr_vid=${vid}` }, 'DELETE');
    expect(await unlike.json()).toEqual({ liked: false, count: 0 });
  });
  it('a forged or malformed cookie is replaced, never trusted as an identity', async () => {
    const r = await like('p1', { ...JSON_H, cookie: 'rr_vid=../../admin' });
    expect(r.headers.get('set-cookie')).toMatch(/rr_vid=[0-9a-f-]{36}/);
  });
  it('a signed-in user likes as themselves: the same account on two browsers counts once', async () => {
    authMock.mockResolvedValue({ user: { email: 'Me@X.co', role: 'customer' } });
    await like('p1'); await like('p1', { ...JSON_H, cookie: `rr_vid=${VID}` });
    const rows = await (await getTestDb()).select().from(productLikes);
    expect(rows.map(r => r.actor)).toEqual(['u:me@x.co']);
  });
  it('a deactivated account falls back to an anonymous visitor', async () => {
    authMock.mockResolvedValue({ user: { email: 'off@x.co', role: 'seller', active: false } });
    await like('p1');
    expect((await (await getTestDb()).select().from(productLikes))[0].actor).toMatch(/^v:/);
  });
  it('an auth failure (missing secret) must not break liking for anonymous visitors', async () => {
    authMock.mockRejectedValue(new Error('NEXTAUTH_SECRET is not set'));
    expect((await like('p1')).status).toBe(200);
  });
  it('requires a JSON content type (415) so a cross-site form post cannot like', async () => {
    expect((await like('p1', { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await like('p1', {})).status).toBe(415);
    expect(await (await getTestDb()).select().from(productLikes)).toHaveLength(0);
  });
  it('404 for unknown or unpublished products', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ name: 'Draft', category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'DRAFT', sellerId: s.id }, admin);
    expect((await like('nope')).status).toBe(404);
    expect((await like(draft.id)).status).toBe(404);
  });
  it('rate limits one actor to 30 likes/unlikes per minute (429), others unaffected', async () => {
    const h = { ...JSON_H, cookie: `rr_vid=${VID}` };
    for (let i = 0; i < 30; i++) expect((await like(i % 2 ? 'p1' : 'p2', h)).status).toBe(200);
    const blocked = await like('p1', h);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('Too many requests.');
    expect((await like('p1', { ...JSON_H, cookie: 'rr_vid=0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' })).status).toBe(200);
  });
});

describe('GET /api/likes', () => {
  it('returns counts for the requested published products and which ones this visitor liked; never cached', async () => {
    const r = await like('p1');
    const vid = /rr_vid=([^;]+)/.exec(r.headers.get('set-cookie')!)![1];
    await like('p1', { ...JSON_H, cookie: 'rr_vid=0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' });
    const res = await likesGet(new Request('http://x/api/likes?ids=p1,p2,bogus,p1', { headers: { cookie: `rr_vid=${vid}` } }));
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ counts: { p1: 2, p2: 0 }, liked: ['p1'] });
  });
  it('without a cookie nothing is "liked"; with no ids it is empty; absurd ids are capped', async () => {
    expect(await (await likesGet(new Request('http://x/api/likes?ids=p1'))).json()).toEqual({ counts: { p1: 0 }, liked: [] });
    expect(await (await likesGet(new Request('http://x/api/likes'))).json()).toEqual({ counts: {}, liked: [] });
    const many = Array.from({ length: 500 }, (_, i) => `p${i}`).join(',');
    expect(Object.keys((await (await likesGet(new Request(`http://x/api/likes?ids=${many}`))).json()).counts).length).toBeLessThanOrEqual(60);
  });
});

describe('POST /api/events', () => {
  it('records a view with a daily hashed viewer (no ip or user agent stored) and answers 204; the same viewer twice is one row', async () => {
    expect((await event({ type: 'view', productId: 'p1' })).status).toBe(204);
    expect((await event({ type: 'view', productId: 'p1' })).status).toBe(204);
    const rows = await (await getTestDb()).select().from(productEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: 'p1', type: 'view' });
    expect(rows[0].actor).toMatch(/^h:[0-9a-f]{32}$/);
    expect(JSON.stringify(rows)).not.toContain('1.2.3.4');
  });
  it('different visitors (ip or user agent) are different people', async () => {
    await event({ type: 'view', productId: 'p1' });
    await event({ type: 'view', productId: 'p1' }, { ...JSON_H, 'user-agent': BROWSER, 'x-forwarded-for': '9.9.9.9' });
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(2);
  });
  it('bots get 204 but nothing is written', async () => {
    expect((await event({ type: 'view', productId: 'p1' }, { ...JSON_H, 'user-agent': 'Googlebot/2.1' })).status).toBe(204);
    expect((await event({ type: 'view', productId: 'p1' }, { ...JSON_H })).status).toBe(204);       // no user agent
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(0);
  });
  it('validates the body: unknown type, bad product id, wrong shapes → 400; non-JSON → 415; invalid JSON → 400', async () => {
    for (const body of [{ type: 'purchase', productId: 'p1' }, { type: 'view', productId: 'x1' }, { type: 'view' }, { productId: 'p1' }, null, [], 'view', { type: 'view', productId: ['p1'] }])
      expect((await event(body)).status).toBe(400);
    expect((await eventsPost(new Request('http://x', { method: 'POST', body: 'type=view', headers: { 'content-type': 'text/plain', 'user-agent': BROWSER } }))).status).toBe(415);
    expect((await eventsPost(new Request('http://x', { method: 'POST', body: '{nope', headers: { ...JSON_H, 'user-agent': BROWSER } }))).status).toBe(400);
  });
  it('events for unpublished or unknown products are accepted with 204 but ignored (no information leak)', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ name: 'Draft', category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'DRAFT', sellerId: s.id }, admin);
    expect((await event({ type: 'view', productId: draft.id })).status).toBe(204);
    expect((await event({ type: 'view', productId: 'p999' })).status).toBe(204);
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(0);
  });
  it('rate limits one ip to 120 events per minute (429)', async () => {
    let last = 204;
    for (let i = 0; i < 125; i++) last = (await event({ type: i % 3 === 0 ? 'view' : i % 3 === 1 ? 'contact' : 'artist', productId: 'p1' }, { ...JSON_H, 'user-agent': BROWSER + i, 'x-forwarded-for': '7.7.7.7' })).status;
    expect(last).toBe(429);
  });
});
```
(Task 4 also creates `src/lib/engagement-limits.ts` exporting `likeLimiter`, `eventLimiter` and `resetLimitersForTests()`.)

`tests/trending-api.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/trending/route';
import { likeProduct, recordEvent } from '@/lib/engagement';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const get = (qs = '') => GET(new Request(`http://x/api/trending${qs}`));

describe('GET /api/trending', () => {
  it('is public, cacheable at the edge for 5 minutes, and an empty list when nothing trends', async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([]);
    expect(r.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=600');
  });
  it('returns public products ranked, with likeCount and sellerSlug and without any private data', async () => {
    await recordEvent({ productId: 'p3', type: 'view', actor: 'h:a' }); await likeProduct('p3', 'v:a');
    const list = await (await get()).json();
    expect(list.map((p: { id: string }) => p.id)).toEqual(['p3']);
    expect(list[0]).toMatchObject({ likeCount: 1, sellerSlug: expect.stringMatching(/^petal-and-pour-[0-9a-f]{8}$/) });
    const text = JSON.stringify(list);
    for (const secret of ['sellerId', 'sellerEmail', 'seed.rangrajasthan', 'h:a', 'v:a', 'pickupLocation']) expect(text).not.toContain(secret);
  });
  it('limit: default 6, clamped to 1..24, garbage ignored', async () => {
    for (const p of ['p1', 'p2', 'p3', 'p4']) await recordEvent({ productId: p, type: 'view', actor: 'h:a' });
    expect((await (await get('?limit=2')).json()).length).toBe(2);
    expect((await (await get('?limit=abc')).json()).length).toBe(4);
    expect((await (await get('?limit=-1')).json()).length).toBe(1);
    expect((await (await get('?limit=999')).json()).length).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify RED.**

- [ ] **Step 3: Implement.**
`src/lib/engagement-limits.ts`:
```ts
import { createLimiter } from './rate-limit';
export let likeLimiter = createLimiter(30, 60_000);
export let eventLimiter = createLimiter(120, 60_000);
export const resetLimitersForTests = () => { likeLimiter = createLimiter(30, 60_000); eventLimiter = createLimiter(120, 60_000); };
```
(Routes import the live bindings: `import * as limits from '@/lib/engagement-limits'` and call `limits.likeLimiter.hit(...)` so the reset takes effect.)

`src/app/api/products/[id]/like/route.ts`:
```ts
import { auth } from '@/auth';
import { VISITOR_COOKIE, isVisitorId, likeActor, newVisitorId, readCookie, visitorCookie } from '@/lib/actors';
import { handle, json } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { likeProduct, unlikeProduct } from '@/lib/engagement';
import * as limits from '@/lib/engagement-limits';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

async function identify(req: Request) {
  let email: string | null = null;
  try { const s = await auth(); if (s?.user?.email && s.user.active !== false) email = s.user.email; } catch { /* anonymous: a broken session must not block liking */ }
  const existing = readCookie(req.headers.get('cookie'), VISITOR_COOKIE);
  const visitorId = isVisitorId(existing) ? existing : newVisitorId();
  return { actor: likeActor({ email, visitorId }), setCookie: isVisitorId(existing) ? null : visitorCookie(visitorId, req.url.startsWith('https://') || req.headers.get('x-forwarded-proto') === 'https') };
}
const guard = (req: Request) => {
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) throw new ApiError(415, 'Content-Type must be application/json');
};
const respond = (body: unknown, setCookie: string | null) => json(body, 200, setCookie ? { 'set-cookie': setCookie } : undefined);

export const POST = (req: Request, { params }: Ctx) => handle(async () => {
  guard(req);
  const { actor, setCookie } = await identify(req);
  if (!limits.likeLimiter.hit(actor)) throw new ApiError(429, 'Too many requests.');
  return respond(await likeProduct((await params).id, actor), setCookie);
});
export const DELETE = (req: Request, { params }: Ctx) => handle(async () => {
  guard(req);
  const { actor, setCookie } = await identify(req);
  if (!limits.likeLimiter.hit(actor)) throw new ApiError(429, 'Too many requests.');
  return respond(await unlikeProduct((await params).id, actor), setCookie);
});
```
`src/app/api/likes/route.ts`:
```ts
import { auth } from '@/auth';
import { VISITOR_COOKIE, isVisitorId, likeActor, readCookie } from '@/lib/actors';
import { handle, json } from '@/lib/api';
import { likeState } from '@/lib/engagement';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => handle(async () => {
  const ids = (new URL(req.url).searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
  let email: string | null = null;
  try { const s = await auth(); if (s?.user?.email && s.user.active !== false) email = s.user.email; } catch { /* anonymous */ }
  const v = readCookie(req.headers.get('cookie'), VISITOR_COOKIE);
  const actor = email ? likeActor({ email, visitorId: '' }) : isVisitorId(v) ? likeActor({ visitorId: v }) : undefined;
  return json(await likeState(ids, actor), 200, { 'cache-control': 'no-store' });
});
```
`src/app/api/events/route.ts`:
```ts
import { clientIp, isBot, viewerActor } from '@/lib/actors';
import { handle, readJson } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { recordEvent, type EventType } from '@/lib/engagement';
import * as limits from '@/lib/engagement-limits';
export const dynamic = 'force-dynamic';
const TYPES: readonly string[] = ['view', 'contact', 'artist'];

export const POST = (req: Request) => handle(async () => {
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) throw new ApiError(415, 'Content-Type must be application/json');
  const ip = clientIp(req.headers);
  if (!limits.eventLimiter.hit(ip)) throw new ApiError(429, 'Too many requests.');
  const body = await readJson(req);
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (typeof b.type !== 'string' || !TYPES.includes(b.type)) throw new ApiError(400, 'type must be view, contact or artist.');
  if (typeof b.productId !== 'string' || !/^p\d+$/.test(b.productId)) throw new ApiError(400, 'productId must look like p1.');
  const ua = req.headers.get('user-agent');
  if (!isBot(ua)) await recordEvent({ productId: b.productId, type: b.type as EventType, actor: viewerActor({ ip, userAgent: ua! }) });
  return new Response(null, { status: 204 });
});
```
`src/app/api/trending/route.ts`:
```ts
import { handle, json } from '@/lib/api';
import { trending } from '@/lib/trending';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => handle(async () => {
  const raw = new URL(req.url).searchParams.get('limit');
  const n = raw === null ? undefined : Number(raw);
  return json(await trending({ limit: n }), 200, { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' });
});
```
(`trending` treats `NaN`/`undefined` as the default and clamps the rest.)

- [ ] **Step 4: Run to verify GREEN** — both files, the whole suite, `npx tsc --noEmit`. Mutations (revert after): remove the content-type guard in the like route → the 415 test FAILS; drop `isBot` → the bot test FAILS; make the cookie check skip `isVisitorId` → the forged-cookie test FAILS.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/products/[id]/like src/app/api/likes src/app/api/events src/app/api/trending src/lib/engagement-limits.ts tests/engagement-api.test.ts tests/trending-api.test.ts
git commit -m "feat: like, likes, events and trending APIs (JSON-only writes, rate limits, bot filter)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client components (LikeButton, TrackOnMount, TrackedLink)

**Files:**
- Create: `src/components/LikeButton.tsx`, `src/components/TrackOnMount.tsx`, `src/components/TrackedLink.tsx`, `src/lib/track.ts`, `tests/like-button.test.tsx`, `tests/tracking.test.tsx`
- Modify: `src/app/globals.css` (like button styles)

**Interfaces:**
- Consumes: Task 4 routes; `gaEvent` from `src/lib/analytics.ts`.
- Produces:
  - `sendEvent(type: 'view'|'contact'|'artist', productId: string): void` (`src/lib/track.ts`; uses `navigator.sendBeacon` with a JSON `Blob`, falls back to `fetch(..., { keepalive: true })`; never throws, never blocks navigation)
  - `<LikeButton productId: string initialCount?: number productName?: string />`
  - `<TrackOnMount productId type />` (sends once per mount, strict-mode safe)
  - `<TrackedLink productId type href …anchorProps />` (an `<a>` that calls `sendEvent` on click and still navigates)

- [ ] **Step 1: Write the failing tests.**

`tests/like-button.test.tsx` (jsdom; mock `fetch`; fake timers not needed):
```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { LikeButton } from '@/components/LikeButton';
import { __resetLikeBatchForTests } from '@/components/LikeButton';

let fetchMock: ReturnType<typeof vi.fn>;
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let likes: Record<string, { count: number; liked: boolean }>;

beforeEach(() => {
  __resetLikeBatchForTests();
  likes = { p1: { count: 3, liked: false }, p2: { count: 0, liked: true } };
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/likes')) {
      const ids = new URL(url, 'http://x').searchParams.get('ids')!.split(',');
      return res(200, { counts: Object.fromEntries(ids.map(i => [i, likes[i]?.count ?? 0])), liked: ids.filter(i => likes[i]?.liked) });
    }
    const m = /\/api\/products\/(p\d+)\/like$/.exec(url)!;
    const id = m[1]; const add = init?.method === 'POST';
    likes[id] = { count: likes[id].count + (add && !likes[id].liked ? 1 : !add && likes[id].liked ? -1 : 0), liked: add };
    return res(200, { liked: add, count: likes[id].count });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const btn = (name: RegExp) => screen.getByRole('button', { name });

describe('LikeButton', () => {
  it('shows the server-rendered count at once and learns whether you liked it with one batched request for all cards on the page', async () => {
    render(<><LikeButton productId="p1" initialCount={3} productName="Bag" /><LikeButton productId="p2" initialCount={0} productName="Dish" /></>);
    expect(btn(/Like Bag/).textContent).toContain('3');
    await waitFor(() => expect(btn(/Unlike Dish/)).toBeTruthy());
    const calls = fetchMock.mock.calls.filter(c => String(c[0]).startsWith('/api/likes'));
    expect(calls).toHaveLength(1);                                    // batched, not one request per card
    expect(new URL(calls[0][0] as string, 'http://x').searchParams.get('ids')!.split(',').sort()).toEqual(['p1', 'p2']);
    expect(btn(/Unlike Dish/).getAttribute('aria-pressed')).toBe('true');
  });
  it('liking is optimistic: the count and pressed state change immediately, then settle on the server count', async () => {
    render(<LikeButton productId="p1" initialCount={3} productName="Bag" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(btn(/Like Bag/));
    expect(btn(/Unlike Bag/).textContent).toContain('4');
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!;
    expect(post[0]).toBe('/api/products/p1/like');
    expect((post[1].headers as Record<string, string>)['content-type']).toBe('application/json');
    fireEvent.click(btn(/Unlike Bag/));
    await waitFor(() => expect(btn(/Like Bag/).textContent).toContain('3'));
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'DELETE')).toBe(true);
  });
  it('a failed request rolls the optimistic change back and does not lie about the count', async () => {
    render(<LikeButton productId="p1" initialCount={3} productName="Bag" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockImplementation(() => res(429, { error: 'Too many requests.' }));
    fireEvent.click(btn(/Like Bag/));
    await waitFor(() => expect(btn(/Like Bag/).textContent).toContain('3'));
    expect(btn(/Like Bag/).getAttribute('aria-pressed')).toBe('false');
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    fireEvent.click(btn(/Like Bag/));
    await waitFor(() => expect(btn(/Like Bag/).textContent).toContain('3'));
  });
  it('ignores clicks while a request is in flight (no double like) and shows the busy state', async () => {
    render(<LikeButton productId="p1" initialCount={3} productName="Bag" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    let release!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { release = r; }));
    fireEvent.click(btn(/Like Bag/));
    fireEvent.click(btn(/Unlike Bag/));
    expect(fetchMock.mock.calls.filter(c => c[1]?.method)).toHaveLength(1);
    expect(btn(/Unlike Bag/).getAttribute('aria-busy')).toBe('true');
    await act(async () => { release({ ok: true, status: 200, json: () => Promise.resolve({ liked: true, count: 4 }) } as Response); });
    await waitFor(() => expect(btn(/Unlike Bag/).getAttribute('aria-busy')).not.toBe('true'));
  });
  it('clicking the heart inside a card never follows the card link (propagation stopped)', async () => {
    const onCard = vi.fn();
    render(<div onClick={onCard}><LikeButton productId="p1" initialCount={0} productName="Bag" /></div>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(btn(/Like Bag/));
    expect(onCard).not.toHaveBeenCalled();
  });
  it('is keyboard accessible: a real button with an accessible name that includes the count for screen readers', () => {
    render(<LikeButton productId="p1" initialCount={1} productName="Bag" />);
    const b = btn(/Like Bag/) as HTMLButtonElement;
    expect(b.type).toBe('button');
    expect(b.getAttribute('aria-label')).toBe('Like Bag (1 like)');
  });
  it('shows a singular/plural label and tolerates a missing initial count', () => {
    render(<LikeButton productId="p9" productName="Thing" />);
    expect(btn(/Like Thing/).getAttribute('aria-label')).toBe('Like Thing (0 likes)');
  });
});
```
`tests/tracking.test.tsx`:
```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { sendEvent } from '@/lib/track';
import { TrackOnMount } from '@/components/TrackOnMount';
import { TrackedLink } from '@/components/TrackedLink';

let beacon: ReturnType<typeof vi.fn>; let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { beacon = vi.fn(() => true); fetchMock = vi.fn(() => Promise.resolve({ ok: true })); Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true }); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const sent = async () => JSON.parse(await (beacon.mock.calls[0][1] as Blob).text());

describe('sendEvent', () => {
  it('posts {type, productId} as JSON through sendBeacon', async () => {
    sendEvent('view', 'p1');
    expect(beacon.mock.calls[0][0]).toBe('/api/events');
    expect((beacon.mock.calls[0][1] as Blob).type).toBe('application/json');
    expect(await sent()).toEqual({ type: 'view', productId: 'p1' });
  });
  it('falls back to a keepalive fetch when sendBeacon is missing or refuses, and never throws', () => {
    beacon.mockReturnValue(false);
    expect(() => sendEvent('contact', 'p2')).not.toThrow();
    expect(fetchMock).toHaveBeenCalledWith('/api/events', expect.objectContaining({ method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' } }));
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    expect(() => sendEvent('artist', 'p3')).not.toThrow();
  });
});

describe('TrackOnMount', () => {
  it('sends once per mount, even if re-rendered; renders nothing', async () => {
    const { container, rerender } = render(<TrackOnMount productId="p1" type="view" />);
    rerender(<TrackOnMount productId="p1" type="view" />);
    expect(container.innerHTML).toBe('');
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(await sent()).toEqual({ type: 'view', productId: 'p1' });
  });
  it('a different product (client-side navigation to another product page) sends a new event', () => {
    const { rerender } = render(<TrackOnMount productId="p1" type="view" />);
    rerender(<TrackOnMount productId="p2" type="view" />);
    expect(beacon).toHaveBeenCalledTimes(2);
  });
});

describe('TrackedLink', () => {
  it('renders a normal anchor with its attributes, sends a contact event on click and does not prevent navigation', async () => {
    render(<TrackedLink productId="p1" type="contact" href="tel:+919989898999" target="_blank" rel="noreferrer">Call</TrackedLink>);
    const a = screen.getByRole('link', { name: 'Call' });
    expect(a.getAttribute('href')).toBe('tel:+919989898999');
    expect(a.getAttribute('target')).toBe('_blank');
    const notPrevented = fireEvent.click(a);
    expect(notPrevented).toBe(true);
    expect(await sent()).toEqual({ type: 'contact', productId: 'p1' });
  });
  it('middle-click and keyboard activation (auxclick / Enter) are also counted once per interaction', () => {
    render(<TrackedLink productId="p1" type="contact" href="mailto:a@b.co">Mail</TrackedLink>);
    const a = screen.getByRole('link', { name: 'Mail' });
    fireEvent.auxClick(a);
    expect(beacon).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify RED.**

- [ ] **Step 3: Implement.**
`src/lib/track.ts`:
```ts
export type TrackType = 'view' | 'contact' | 'artist';

/** Fire-and-forget first-party engagement event. Never throws and never delays navigation. */
export function sendEvent(type: TrackType, productId: string): void {
  try {
    const body = JSON.stringify({ type, productId });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/events', new Blob([body], { type: 'application/json' }))) return;
    void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch { /* tracking must never break the page */ }
}
```
`src/components/TrackOnMount.tsx`:
```tsx
'use client';
import { useEffect, useRef } from 'react';
import { gaEvent } from '@/lib/analytics';
import { sendEvent, type TrackType } from '@/lib/track';

const GA_NAMES: Record<TrackType, string> = { view: 'view_item', contact: 'contact_click', artist: 'artist_visit' };

/** Records one event for this product when the page appears (strict-mode safe). Renders nothing. */
export function TrackOnMount({ productId, type }: { productId: string; type: TrackType }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const key = `${type}:${productId}`;
    if (last.current === key) return;
    last.current = key;
    sendEvent(type, productId);
    gaEvent(GA_NAMES[type], { item_id: productId });
  }, [productId, type]);
  return null;
}
```
`src/components/TrackedLink.tsx`:
```tsx
'use client';
import type { AnchorHTMLAttributes } from 'react';
import { gaEvent } from '@/lib/analytics';
import { sendEvent, type TrackType } from '@/lib/track';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { productId: string; type: TrackType; href: string };

/** A normal link that also records an engagement event (e.g. a contact click) without delaying the navigation. */
export function TrackedLink({ productId, type, onClick, onAuxClick, ...rest }: Props) {
  const track = () => { sendEvent(type, productId); gaEvent(type === 'contact' ? 'contact_click' : 'artist_visit', { item_id: productId }); };
  return <a {...rest} onClick={e => { track(); onClick?.(e); }} onAuxClick={e => { if (e.button === 1) track(); onAuxClick?.(e); }} />;
}
```
(In the test, `fireEvent.auxClick(a)` has `button: 0` by default; use `fireEvent.auxClick(a, { button: 1 })` — update that test line accordingly.)

`src/components/LikeButton.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { gaEvent } from '@/lib/analytics';

type LikeInfo = { counts: Record<string, number>; liked: string[] };
let pending: Map<string, (i: { count: number; liked: boolean }) => void> | null = null;
export const __resetLikeBatchForTests = () => { pending = null; };

/** All LikeButtons that mount in the same tick share ONE GET /api/likes?ids=…, so a grid of 24 cards costs one request. */
function loadState(id: string): Promise<{ count: number; liked: boolean }> {
  return new Promise(resolve => {
    if (!pending) {
      const batch = new Map<string, (i: { count: number; liked: boolean }) => void>();
      pending = batch;
      setTimeout(async () => {
        pending = null;
        try {
          const r = await fetch(`/api/likes?ids=${encodeURIComponent([...batch.keys()].join(','))}`);
          const data = (await r.json()) as LikeInfo;
          for (const [pid, done] of batch) done({ count: data.counts[pid] ?? 0, liked: data.liked.includes(pid) });
        } catch { for (const done of batch.values()) done({ count: -1, liked: false }); }
      }, 0);
    }
    pending.set(id, resolve);
  });
}

export function LikeButton({ productId, initialCount = 0, productName = 'this product' }: { productId: string; initialCount?: number; productName?: string }) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadState(productId).then(s => { if (alive) { setLiked(s.liked); if (s.count >= 0) setCount(s.count); } });
    return () => { alive = false; };
  }, [productId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); // the heart sits on a clickable card: never follow its link
    if (busy) return;
    const next = !liked;
    const before = { liked, count };
    setBusy(true); setLiked(next); setCount(c => Math.max(0, c + (next ? 1 : -1)));
    try {
      const r = await fetch(`/api/products/${productId}/like`, { method: next ? 'POST' : 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { liked: boolean; count: number };
      setLiked(data.liked); setCount(data.count);
      if (data.liked) gaEvent('like', { item_id: productId });
    } catch { setLiked(before.liked); setCount(before.count); }
    setBusy(false);
  }

  return (
    <button type="button" className={`like-btn${liked ? ' liked' : ''}`} aria-pressed={liked} aria-busy={busy} disabled={busy && false}
      aria-label={`${liked ? 'Unlike' : 'Like'} ${productName} (${count} ${count === 1 ? 'like' : 'likes'})`} onClick={toggle}>
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span> <span aria-hidden="true">{count}</span>
    </button>
  );
}
```
(Do not set `disabled` while busy: the global `button[aria-busy=true]` CSS already blocks pointer events; the `busy` guard stops keyboard double-activation. Remove the placeholder `disabled={busy && false}` from the final code; it is shown here only to make clear that `disabled` is intentionally absent.)
Append to `globals.css`:
```css
.like-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--control-border);background:transparent;color:var(--ink);border-radius:30px;padding:6px 11px;font:600 11px var(--font-sans),sans-serif;cursor:pointer;position:relative;z-index:1}
.like-btn:hover{border-color:var(--orange);color:var(--orange)}.like-btn.liked{color:#c0392b;border-color:#e0b9ad;background:#f9ece7}
.like-btn[aria-busy=true]{padding-right:11px!important;opacity:1}.like-btn[aria-busy=true]::after{display:none}
```
(the `[aria-busy]` override keeps the heart button compact instead of growing a spinner column.)

- [ ] **Step 4: Run to verify GREEN** — both files, whole suite, `npx tsc --noEmit`. Mutations (revert after): drop `e.stopPropagation()` → the card-click test FAILS; remove the rollback in `catch` → the failure test FAILS; remove `last.current` guard in `TrackOnMount` → the once-per-mount test FAILS.

- [ ] **Step 5: Commit** (stage `globals.css` only if `git diff src/app/globals.css` is just your block; otherwise leave it unstaged and tell the user)
```bash
git add src/lib/track.ts src/components/LikeButton.tsx src/components/TrackOnMount.tsx src/components/TrackedLink.tsx tests/like-button.test.tsx tests/tracking.test.tsx
git commit -m "feat: LikeButton (batched state, optimistic), TrackOnMount and TrackedLink

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pages and wiring (cards, product page, artist page, trending section and page, sitemap)

**Files:**
- Create: `src/lib/artists.ts`, `src/components/TrendingSection.tsx`, `src/app/artists/[slug]/page.tsx`, `src/app/trending/page.tsx`, `tests/artists.test.ts`, `tests/trending-pages.test.tsx`
- Modify: `src/components/ProductCard.tsx`, `src/app/products/[slug]/page.tsx`, `src/app/page.tsx`, `src/app/sitemap.ts`, `src/app/globals.css`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `getArtist(slug: string): Promise<{ name: string; slug: string; phone?: string; email?: string; instagram?: string; youtube?: string; products: Product[] } | undefined>`; `<TrendingSection />` (async server component; renders `null` when nothing trends); routes `/artists/[slug]` and `/trending`.

- [ ] **Step 1: Write the failing tests.**

`tests/artists.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getArtist } from '@/lib/artists';
import { artistIdPrefix, artistSlug } from '@/lib/artist-slug';
import { createProduct, updateProduct } from '@/lib/admin';
import { saveProfile } from '@/lib/users';
import { listProducts } from '@/lib/catalog';
import { admin } from './helpers/actors';
import { makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const slugOf = async (productId: string) => (await listProducts()).find(p => p.id === productId)!.sellerSlug!;

describe('artist slugs', () => {
  it('are "<slugified name>-<first 8 hex of the id>", never the full id; names that slugify to nothing still work', () => {
    const id = '6b13cbf3-19bb-4099-a963-e9661a5e1ff8';
    expect(artistSlug('Shauk & Stuff', id)).toBe('shauk-and-stuff-6b13cbf3');
    expect(artistSlug('✿✿✿', id)).toBe('artist-6b13cbf3');
    expect(artistSlug('X', id)).not.toContain('e9661a5e1ff8');
    expect(artistIdPrefix('shauk-and-stuff-6b13cbf3')).toBe('6b13cbf3');
    for (const bad of ['', 'nohex', 'name-6B13CBF3', 'name-123', 'name-6b13cbf3z']) expect(artistIdPrefix(bad)).toBeUndefined();
  });
});

describe('getArtist', () => {
  it('returns the artist with only their published products and their public contact', async () => {
    const slug = await slugOf('p1');
    const a = (await getArtist(slug))!;
    expect(a.name).toBe('Shauk and Stuff');
    expect(a.products.map(p => p.id)).toEqual(['p1']);
    expect(a).not.toHaveProperty('id');
    expect(JSON.stringify(a)).not.toContain('seed.rangrajasthan');
  });
  it('shows public profile contact details (phone, email, social) and nothing private', async () => {
    const s = await makeSeller('contact@x.co', 'Contact Studio');
    await saveProfile(s.id, { displayName: 'Contact Studio', publicPhone: '99898 98999', publicEmail: 'hi@studio.co', instagram: 'studio', youtube: '@studio' });
    const p = await createProduct({ name: 'Bowl', category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin);
    const a = (await getArtist(await slugOf(p.id)))!;
    expect(a).toMatchObject({ phone: '9989898999', email: 'hi@studio.co', instagram: 'studio', youtube: '@studio' });
    expect(JSON.stringify(a)).not.toContain('contact@x.co');                       // the login email is private
  });
  it('is undefined for unknown slugs, a wrong name part, junk, and artists with no published product (drafts are not enumerable)', async () => {
    const s = await makeSeller('draft@x.co', 'Only Drafts');
    const d = await createProduct({ name: 'Hidden', category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'DRAFT', sellerId: s.id }, admin);
    const draftSlug = artistSlug('Only Drafts', s.id);
    expect(await getArtist(draftSlug)).toBeUndefined();
    const real = await slugOf('p1');
    expect(await getArtist(real.replace(/^.*-/, 'wrong-name-'))).toBeUndefined();
    for (const bad of ['', 'x', '../../etc/passwd', 'a-00000000', real + 'x', "x-' or 1=1 --"]) expect(await getArtist(bad)).toBeUndefined();
    await updateProduct(d.id, { status: 'APPROVED' }, admin);
    expect(await getArtist(draftSlug)).toBeDefined();
  });
  it('stays correct after the seller renames their public profile (the slug follows the name, old slugs 404)', async () => {
    const old = await slugOf('p1');
    const { users } = await import('@/db/schema');
    const { getTestDb } = await import('./helpers/testdb');
    const { eq } = await import('drizzle-orm');
    const [u] = await (await getTestDb()).select().from(users).where(eq(users.email, 'shauk-and-stuff@seed.rangrajasthan.invalid'));
    await saveProfile(u.id, { displayName: 'Renamed Studio' });
    expect(await getArtist(old)).toBeUndefined();
    expect((await getArtist(await slugOf('p1')))!.name).toBe('Renamed Studio');
  });
});
```
`tests/trending-pages.test.tsx` (jsdom; render the async server components by awaiting them):
```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/AddToCartButton', () => ({ AddToCartButton: () => <button>add</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: ({ productId, initialCount }: any) => <button data-like={productId}>{`♡ ${initialCount}`}</button> }));
vi.mock('@/components/TrackOnMount', () => ({ TrackOnMount: ({ productId, type }: any) => <i data-track={`${type}:${productId}`} /> }));
vi.mock('@/components/TrackedLink', () => ({ TrackedLink: ({ productId, type, ...r }: any) => <a data-tracked={`${type}:${productId}`} {...r} /> }));
const nav = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }) }));
vi.mock('next/navigation', () => nav);
import { TrendingSection } from '@/components/TrendingSection';
import { ProductCard } from '@/components/ProductCard';
import { likeProduct, recordEvent } from '@/lib/engagement';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); nav.notFound.mockClear(); });
afterEach(cleanup);

describe('TrendingSection (home page)', () => {
  it('renders nothing at all while nothing is trending', async () => {
    expect(await TrendingSection()).toBeNull();
  });
  it('shows a "Trending now" row with a Show all link once something trends, one card per artist', async () => {
    await recordEvent({ productId: 'p1', type: 'view', actor: 'h:a' }); await likeProduct('p2', 'v:a');
    render(await TrendingSection());
    expect(screen.getByRole('heading', { name: 'Trending now' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Show all/ }).getAttribute('href')).toBe('/trending');
    expect(document.querySelectorAll('.product-card')).toHaveLength(2);
  });
});

describe('ProductCard', () => {
  it('has a like button with the count, and the card still links to the product', () => {
    const p = { id: 'p1', name: 'Bag', category: 'Pottery', city: 'Jaipur', pricePaise: 100, seller: 'S', description: 'd', stock: 1, status: 'APPROVED', likeCount: 4, sellerSlug: 's-12345678' };
    render(<ProductCard p={p} />);
    expect(document.querySelector('[data-like="p1"]')!.textContent).toBe('♡ 4');
    expect(screen.getByRole('link', { name: 'Bag' }).getAttribute('href')).toBe('/products/bag-p1');
  });
});

describe('/trending page', () => {
  it('lists trending products with breadcrumbs and an honest empty state', async () => {
    const Page = (await import('@/app/trending/page')).default;
    render(await Page());
    expect(screen.getByText('Nothing is trending yet. Like a product to start the trend.')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    cleanup();
    await recordEvent({ productId: 'p1', type: 'view', actor: 'h:a' });
    render(await Page());
    expect(document.querySelectorAll('.product-card')).toHaveLength(1);
  });
});

describe('/artists/[slug] page', () => {
  it('shows the artist, their published products and counts an artist visit only when ?from is one of their products', async () => {
    const { listProducts } = await import('@/lib/catalog');
    const slug = (await listProducts()).find(p => p.id === 'p1')!.sellerSlug!;
    const Page = (await import('@/app/artists/[slug]/page')).default;
    render(await Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ from: 'p1' }) }));
    expect(screen.getByRole('heading', { level: 1, name: 'Shauk and Stuff' })).toBeTruthy();
    expect(document.querySelectorAll('.product-card')).toHaveLength(1);
    expect(document.querySelector('[data-track="artist:p1"]')).toBeTruthy();
    cleanup();
    render(await Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ from: 'p3' }) }));   // another artist's product: no credit
    expect(document.querySelector('[data-track]')).toBeNull();
    cleanup();
    render(await Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ from: '<script>' }) }));
    expect(document.querySelector('[data-track]')).toBeNull();
  });
  it('is a 404 for unknown artists', async () => {
    const Page = (await import('@/app/artists/[slug]/page')).default;
    await expect(Page({ params: Promise.resolve({ slug: 'nobody-00000000' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  });
});
```
(The product page itself is a long server component; its wiring is covered by the live check in Step 5 and the source-level test below, added to the same file:)
```tsx
import fs from 'node:fs';
describe('product page wiring (source contract)', () => {
  const src = fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8');
  it('records a view, links to the artist page with the product id, and tracks all four contact links', () => {
    expect(src).toContain('<TrackOnMount productId={p.id} type="view" />');
    expect(src).toContain('/artists/${p.sellerSlug}?from=${p.id}');
    expect(src.match(/<TrackedLink productId=\{p\.id\} type="contact"/g)).toHaveLength(4);   // instagram, youtube, phone, email
    expect(src).toContain('<LikeButton');
    expect(src).not.toMatch(/<a href=\{(instagramUrl|youtubeUrl)/);                         // no untracked social links left
  });
});
```

- [ ] **Step 2: Run to verify RED.**

- [ ] **Step 3: Implement.**
`src/lib/artists.ts`:
```ts
import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { products, sellerProfiles, users } from '../db/schema';
import { artistIdPrefix, artistSlug } from './artist-slug';
import type { Product } from './types';

export type Artist = { name: string; slug: string; phone?: string; email?: string; instagram?: string; youtube?: string; products: Product[] };

/** Public artist page data. Undefined unless the artist has at least one published product and the slug is exactly current. */
export async function getArtist(slug: string): Promise<Artist | undefined> {
  const prefix = artistIdPrefix(slug);
  if (!prefix) return undefined;
  const db = getDb();
  const candidates = await db.select({ id: users.id }).from(users).where(sql`replace(${users.id}::text, '-', '') like ${prefix + '%'}`).orderBy(asc(users.id));
  for (const { id } of candidates) {
    const rows = await productsQuery(db).where(and(eq(products.sellerId, id), eq(products.status, 'APPROVED'))).orderBy(sql`length(${products.id}) desc`, sql`${products.id} desc`);
    if (!rows.length) continue;
    const name = rows[0].sellerName;
    if (artistSlug(name, id) !== slug) continue;
    const [pf] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, id));
    return {
      name, slug,
      ...(pf?.publicPhone ? { phone: pf.publicPhone } : {}), ...(pf?.publicEmail ? { email: pf.publicEmail } : {}),
      ...(pf?.instagram ? { instagram: pf.instagram } : {}), ...(pf?.youtube ? { youtube: pf.youtube } : {}),
      products: rows.map(toProduct),
    };
  }
  return undefined;
}
```
`src/components/TrendingSection.tsx`:
```tsx
import Link from 'next/link';
import { ProductGrid } from './ProductGrid';
import { trending } from '@/lib/trending';

/** Home-page row of what people are loving this week. Hidden until something actually trends. */
export async function TrendingSection() {
  const items = await trending({ limit: 6 });
  if (!items.length) return null;
  return (
    <section className="section" id="trending" aria-labelledby="trending-h">
      <div className="section-heading">
        <div><span className="eyebrow">LOVED THIS WEEK</span><h2 id="trending-h">Trending now</h2></div>
        <Link className="text-link" href="/trending">Show all →</Link>
      </div>
      <ProductGrid products={items} />
    </section>
  );
}
```
`src/app/trending/page.tsx`: server page mirroring `/shop` (breadcrumbs `[{Home,'/'},{Trending,'/trending'}]`, `JsonLd` breadcrumb, `pageMetadata({ title: 'Trending handmade finds', description: 'The handmade products people are loving this week, one favourite from each artist.', path: '/trending' })`, `export const dynamic = 'force-dynamic'`, heading `<h1>Trending handmade finds</h1>`, `ProductGrid products={await trending({ limit: 24 })} emptyMessage="Nothing is trending yet. Like a product to start the trend."`).
`src/app/artists/[slug]/page.tsx`: server page: `generateMetadata` (title `${name} — handmade by an independent artist`, description from the first product, `path: /artists/${slug}`, 404 metadata with `robots: { index: false }` when missing), page body: `Breadcrumbs` (`Home › Artists › name` where the middle crumb is plain text pointing at `/shop`), `<h1>{artist.name}</h1>`, contact list (phone `tel:`, email `mailto:`, Instagram/YouTube `https` links with `rel="noreferrer"`), `<TrackOnMount productId={fromId} type="artist" />` only when `fromId` is set, and `<ProductGrid products={artist.products} />`. `searchParams` is `Promise<{ from?: string }>`; `fromId = artist.products.find(p => p.id === sp.from)?.id`.
`src/components/ProductCard.tsx`: in `.product-bottom` render `<LikeButton productId={p.id} initialCount={p.likeCount ?? 0} productName={p.name} />` between the price and the add button (wrap price + like in a flex `<span className="price-like">`).
`src/app/products/[slug]/page.tsx`: (a) imports `LikeButton`, `TrackOnMount`, `TrackedLink`; (b) after `<h1>{p.name}</h1>` add `<LikeButton productId={p.id} initialCount={p.likeCount ?? 0} productName={p.name} />` and `<TrackOnMount productId={p.id} type="view" />`; (c) replace the Artist row's `<dd>{p.seller}</dd>` with `<dd>{p.sellerSlug ? <Link href={`/artists/${p.sellerSlug}?from=${p.id}`}>{p.seller}</Link> : p.seller}</dd>`; (d) replace the four contact anchors with tracked ones, keeping every attribute and label:
```tsx
{p.instagram && <><dt>…unchanged…</dt><dd><TrackedLink productId={p.id} type="contact" href={instagramUrl(p.instagram)} target="_blank" rel="noreferrer">{p.instagram.startsWith('@') ? p.instagram : `@${p.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')}`} ↗</TrackedLink></dd></>}
{p.youtube && <><dt>…unchanged…</dt><dd><TrackedLink productId={p.id} type="contact" href={youtubeUrl(p.youtube)} target="_blank" rel="noreferrer">Visit channel ↗</TrackedLink></dd></>}
{p.phone && <><dt>…unchanged…</dt><dd><TrackedLink productId={p.id} type="contact" href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}>{p.phone}</TrackedLink></dd></>}
{p.email && <><dt>…unchanged…</dt><dd><TrackedLink productId={p.id} type="contact" href={`mailto:${p.email}`}>{p.email}</TrackedLink></dd></>}
```
(Edit only the `<a …>…</a>` inside each `<dd>`; leave the `<dt>` icons exactly as they are in the file.)
`src/app/page.tsx`: `import { TrendingSection } from '@/components/TrendingSection';` and render `<TrendingSection />` right after `<Hero />`.
`src/app/sitemap.ts`: add `{ url: abs('/trending'), changeFrequency: 'daily', priority: 0.6 }` and one entry per artist with published products: `abs('/artists/' + slug)` (unique `sellerSlug` values from `products`).
`globals.css` (append): `.price-like{display:flex;align-items:center;gap:10px}` and a small `.artist-contact{display:flex;flex-wrap:wrap;gap:8px 18px;margin:0 0 18px;padding:0;list-style:none;font-size:12.5px}` block.

- [ ] **Step 4: Run to verify GREEN** — both files, the whole suite (existing tests that count buttons in `ProductCard` / `HomeCraftExplorer` may need their queries narrowed to the `Add to bag` button), `npx tsc --noEmit`. Mutation (revert after): in `getArtist` drop the `APPROVED` filter → the drafts test FAILS.

- [ ] **Step 5: Live check** (`npm run db:up`, `npm run db:migrate`, dev server on 3001 restarted; forged cookies as in earlier checks; remove test data afterwards):
  1. Create two sellers with one published product each (via the admin API). `curl -s localhost:3001/api/trending` → `[]`; `/` has no "Trending now"; `/trending` shows the empty state.
  2. `curl -s -X POST localhost:3001/api/events -H 'content-type: application/json' -H 'user-agent: Mozilla/5.0 (Macintosh) Safari/605' -d '{"type":"view","productId":"<id>"}' -i` → `204`; again → `204`; `select count(*) from product_events` → `1`. With `-H 'user-agent: curl/8'` → `204` and no new row.
  3. Like twice with the same cookie jar (`curl -c jar -b jar -X POST …/like -H 'content-type: application/json' -d '{}'`) → count stays 1, `Set-Cookie: rr_vid` only the first time; without the content-type → `415`.
  4. `/api/trending` now lists the product with `likeCount: 1`; the home page shows "Trending now" with one card per artist; the artist page `/artists/<sellerSlug>?from=<productId>` returns 200 and a following `select type, count(*) from product_events group by type` shows an `artist` row only after the browser (or a manual POST) sends it.
  5. Clean up: delete the test products/sellers/likes/events (`delete from products where …` cascades).

- [ ] **Step 6: Commit**
```bash
git add src/lib/artists.ts src/components/TrendingSection.tsx src/app/artists src/app/trending tests/artists.test.ts tests/trending-pages.test.tsx
git add src/components/ProductCard.tsx "src/app/products/[slug]/page.tsx" src/app/page.tsx src/app/sitemap.ts   # only if git diff shows nothing but your changes
git commit -m "feat: trending row and page, artist pages, likes on cards and product pages, tracked contact links

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Real-Postgres concurrency test, docs, final checks

**Files:**
- Modify: `tests/pg-concurrency.test.ts`, `README.md`
- Create: `docs/trending.md`

**Interfaces:**
- Consumes: everything above; Docker Postgres from `npm run db:up`.

- [ ] **Step 1: Add to `tests/pg-concurrency.test.ts`** (inside the existing `describe.skipIf`, after the others):

```ts
it('likes: 30 parallel likes by one actor leave one row; 40 parallel likes by different actors count exactly 40; events dedupe under parallel writes', async () => {
  const { likeProduct, likeState, recordEvent } = await import('@/lib/engagement');
  await Promise.all(Array.from({ length: 30 }, () => likeProduct('p1', 'v:same')));
  expect((await likeState(['p1'])).counts.p1).toBe(1);
  await Promise.all(Array.from({ length: 40 }, (_, i) => likeProduct('p2', `v:${i}`)));
  expect((await likeState(['p2'])).counts.p2).toBe(40);
  const rs = await Promise.all(Array.from({ length: 30 }, () => recordEvent({ productId: 'p3', type: 'view', actor: 'h:same' }, new Date('2026-10-20T10:00:00Z'))));
  expect(rs.filter(r => r === 'recorded')).toHaveLength(1);
});

it('trending works on real Postgres: weighted order, window and one product per artist', async () => {
  const { trending } = await import('@/lib/trending');
  const { likeProduct, recordEvent } = await import('@/lib/engagement');
  await recordEvent({ productId: 'p1', type: 'view', actor: 'h:a' }); await likeProduct('p3', 'v:a');
  await recordEvent({ productId: 'p3', type: 'view', actor: 'h:a' });
  expect((await trending()).map(p => p.id)).toEqual(['p3', 'p1']);
});
```
Run `npm run test:pg` → all pass.

- [ ] **Step 2: Docs.** `docs/trending.md`: how trending is computed (signals, weights, 7-day window, one per artist, max-normalisation example with numbers), what is recorded and what is not (likes: visitor cookie `rr_vid` or the account; events: daily salted hash, no IP/UA stored; bots ignored), the `ANALYTICS_SALT` env var (set a long random value in production; changing it resets unique-visitor identity, harmless), how likes behave (anonymous per browser, signed-in per account), data growth (one `product_events` row per product+type+visitor+day; delete rows older than 90 days with `delete from product_events where day < current_date - 90`, safe because trending only reads 7 days), and what changes if you want different weights (`WEIGHTS` in `src/lib/trending.ts`, the pure function is covered by `tests/trending-score.test.ts`). README: add a short "Trending and likes" section linking the doc and listing the new endpoints in the API table (`POST|DELETE /api/products/:id/like`, `GET /api/likes`, `POST /api/events`, `GET /api/trending`) and pages (`/trending`, `/artists/:slug`). Add `ANALYTICS_SALT=` (commented, optional) to `.env.backend.example`.

- [ ] **Step 3: Final checks.**
```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
npx vitest run --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000 2>&1 | grep -E "Tests |Test Files|×"
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/"
npx next build 2>&1 | grep -E "rror|Compiled"
BASE_URL=http://localhost:3001 node scripts/seo-check.mjs | grep -E "^FAIL|checks passed"
```
Add to `scripts/seo-check.mjs`: `/trending` returns 200 with exactly one `<h1>`; `POST /api/events` without JSON content type returns 415; `POST /api/products/p1/like` without JSON content type returns 415; `/api/trending` returns 200 with the public cache header. Expected: all green.

- [ ] **Step 4: Commit**
```bash
git add tests/pg-concurrency.test.ts docs/trending.md scripts/seo-check.mjs .env.backend.example
# README.md: stage only if git diff shows nothing but your section
git commit -m "feat: trending docs, real-Postgres concurrency tests and smoke checks

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** trending products of different artists → Task 3 (`pickDiverse`, one per artist) + Task 6 (home row, `/trending`); "based on like functionality" → Tasks 1, 4, 5 (likes for anyone, anonymous cookie / account) and the 20% likes signal; the weighted mix from the screenshot (views 35, contact clicks 25, artist-profile visits 20, likes 20) → Task 3 `WEIGHTS`, signals recorded by Tasks 1, 4, 5, 6 (`view` on the product page, `contact` on the four contact links, `artist` on the artist page reached from the product via `?from=`); GA4 events for these live in the companion GA4 plan (this plan emits `view_item`, `like`, `contact_click`, `artist_visit` through `gaEvent`).

**Placeholder scan:** none left. Two intentional notes in the plan text (the `disabled={busy && false}` remark in `LikeButton`, and the product-page edit that says "keep the `<dt>` icons as they are") exist because the surrounding lines are long and unchanged; the replaced `<a>` elements are given in full.

**Type consistency:** `EventType`/`TrackType` are the same three literals everywhere; `Signals`, `WEIGHTS`, `scoreSignals`, `pickDiverse`, `trending` agree between Task 3 and Tasks 4, 6, 7; `likeProduct/unlikeProduct/likeState/recordEvent` signatures match their uses in Tasks 4, 5 (via HTTP) and 7; `artistSlug/artistIdPrefix` (Task 1) are used by `toProduct` (Task 1) and `getArtist` (Task 6); `sellerSlug`/`likeCount` are optional on `Product` so existing tests keep compiling; actors prefixes (`u:`, `v:`, `h:`) are consistent between `actors.ts`, the routes and the tests.

**Review Focus coverage:** (1) abuse: Task 2 (limiter, bot filter), Task 4 (415, 429, cookie forgery, draft events), Task 6 (artist credit only for the artist's own product); (2) ranking: Task 3 pure + DB tests (normalisation, zero signals, ties, window, one-per-artist, unpublished); (3) privacy: Task 1 (public JSON has no actor data), Task 2 (hash has no ip/ua), Task 4 (trending API leak check), Task 6 (artist page hides login email); (4) concurrency: Task 1 + Task 7; (5) odd data: Tasks 1, 3, 4 (limit abuse, deleted product cascade), Task 6 (seller with only drafts, empty-name slug).

**Known limits / decisions to confirm:**
(a) Anonymous likes can be inflated by clearing cookies; the per-actor rate limit (30/min) and the 7-day max-normalised score limit the damage, but it is not tamper-proof. Signed-in likes are per account.
(b) Max-normalisation means a quiet shop can show a product as "trending" from a single view; there is no minimum-activity threshold. Say so if you want one (for example "at least 3 unique people").
(c) Sign-in is currently hidden in the header, so signed-in likes only occur once the sign-in button returns.
(d) "WhatsApp" contact clicks from the screenshot do not exist yet: contact clicks count phone, email, Instagram and YouTube links. A WhatsApp button would be one more `TrackedLink`.
(e) The in-memory rate limiter is per process; with several containers use a shared store.
(f) Trending results are cached 5 minutes at the edge/CDN (`s-maxage=300`); the home page and `/trending` themselves are rendered dynamically on every request.
(g) First-party events are counted independently of the GA4 consent banner because they store no identifier that can be linked across days; GA4 itself still loads only after consent.
