# Postgres (Docker) Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JSON-file store (`data/db.json`) with a Postgres database running in Docker (docker compose), keeping every existing API contract, page behavior and module interface unchanged.

**Architecture:** A new `src/db/` package (Drizzle schema, lazy client, row↔domain mappers, id allocator, seed library) sits under the existing domain modules. `catalog.ts`, `admin-posts.ts`, `orders.ts`, `admin.ts` and the admin summary route keep their exported function names and signatures but query Postgres; stock/seat changes and id allocation happen inside transactions with row locks. Unit tests run against an in-process PGlite (real Postgres compiled to WASM, no Docker needed for `npm test`); a separate opt-in suite (`npm run test:pg`) runs the concurrency tests against the real Docker Postgres. `data/db.json` stays in the repo as the seed source (`npm run db:seed`).

**Tech Stack:** Docker Compose (`postgres:16-alpine`), Drizzle ORM `0.45.4` + drizzle-kit `0.31.11` (latest stable), `postgres` (postgres-js) `3.4.9`, `@electric-sql/pglite` `0.5.10` (tests only), `tsx` `4.23.15` (scripts), Next.js 16, Vitest.

**Spec:** No spec doc. Requirements = user messages: "we are using any local postgres db for data?" → "use docker for postgres db"; user decisions: **Drizzle ORM**, **PGlite for automated tests**, **import existing data with a seed script**; behavior baseline = current code (`src/lib/{db,catalog,orders,admin,admin-posts}.ts`, `src/app/api/**`, `README.md`).

## Environment facts (checked 2026-10-15)

- Docker CLI 29.6.2 + Compose v5.3.1 are installed, but the **Docker daemon is not running**. Start Docker Desktop before any step that says "requires Docker" (`open -a Docker`, then wait until `docker info` succeeds).
- A **local Postgres is already listening on `localhost:5432`** (a `postgres` process owned by the user). The container therefore maps **host port 5433**, bound to `127.0.0.1` only. Never touch the local Postgres.
- Use Node 22: `export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH`. Port 3100 is used by another app; use 3217 for scratch servers. A user `next dev` may be running on 3000: do not `rm -rf .next`, do not kill it.
- `data/db.json` holds 4 products, 3 workshops, 0 orders, 0 bookings. `tests/fixtures/db.json` holds the same shape and is used for tests.

## Global Constraints

- API contracts unchanged: same routes, status codes, JSON shapes and error messages (e.g. `'A product is unavailable or quantity exceeds stock.'`, `'Not enough seats remaining.'`, `'Product not found.'`). Exported names/signatures of `listProducts`, `listWorkshops`, `getProductBySlug`, `getWorkshopBySlug`, `createOrder`, `createBooking`, `listOrders`, `listBookings`, `createProduct`, `updateProduct`, `deleteProduct`, `createWorkshop`, `updateWorkshop`, `deleteWorkshop`, `listProductsForAdmin`, `getProductForAdmin`, `listArtists` do not change.
- Ids stay strings: products `p<n>`, workshops `w<n>`, orders/bookings UUIDs. Ids are never reused (persisted counter).
- Domain objects returned to callers must be JSON-identical to today: optional product fields are **absent** (never `null`) when unset; `createdAt` is an ISO string.
- Docker: image `postgres:16-alpine`, container port 5432 → host `127.0.0.1:5433`, named volume `rr_pgdata`, healthcheck via `pg_isready`. Dev credentials `rr` / `rr_dev_password` / db `rajasthan` are local-development defaults only and must be documented as such.
- Connection string comes from `DATABASE_URL`; missing/unreachable DB must produce a clear error, never a hang or a silent fallback to the JSON file.
- `next build` renders static pages from the DB, so the DB must be running and migrated when building (document it).
- Stable package versions only (the `latest` dist-tag): no beta/rc/canary builds. PGlite is a 0.x package and is a **devDependency used only by tests**.
- No raw string interpolation of user input into SQL; LIKE wildcards in search text (`%`, `_`, `\`) are escaped so search stays a literal substring match.
- Commits use the repo identity (`shellyy0819`) and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Concurrency on the real database:** parallel orders, bookings and admin creates must never oversell stock/seats, hand out duplicate ids, or deadlock (including two orders that list the same products in opposite orders). PGlite serialises everything, so this is only provable on Docker Postgres. (Task 4, `tests/pg-concurrency.test.ts`)
2. **Search text with SQL/LIKE metacharacters:** `100%`, `_`, `\`, quotes, `'; drop table products; --`, 10 000-character strings → literal match or empty result, no error, tables intact. (Task 3, `tests/catalog.test.ts`)
3. **Clearing optional fields:** PATCH with `""`/whitespace for `instagram`, `phone`, `imageUrl`… must write `NULL`, and `null` must never appear in API JSON (field omitted). (Task 2 mapper tests, Task 3 admin tests)
4. **Database unavailable / `DATABASE_URL` missing:** API routes answer a JSON 500 (not hang or crash the server), pages hit the error boundary, and everything recovers when the DB comes back without restarting Next. (Task 4 live check)
5. **Seed idempotency and id counters:** running `db:seed` twice never duplicates rows or lowers a counter; a deleted highest id is never handed out again, even after a re-seed; deleting a product keeps past orders' item history. (Task 2 seed tests, Task 3 orders test)

---

## File Structure

```
docker-compose.yml                  # Postgres service
drizzle.config.ts                   # drizzle-kit config (schema → ./drizzle)
drizzle/                            # generated SQL migrations (committed)
src/db/schema.ts                    # tables + constraints
src/db/client.ts                    # getDb()/setDb(), Database/Tx/Q types
src/db/mappers.ts                   # row ↔ domain (Product, Workshop, Order, Booking)
src/db/ids.ts                       # allocateId(q, 'p'|'w')
src/db/seed.ts                      # LegacyDb, truncateAll(), seedFromJson()
scripts/db-seed.ts                  # CLI: seed / --reset from data/db.json
tests/helpers/testdb.ts             # PGlite harness: resetTestDb(), getTestDb(), snapshot()
tests/db-schema.test.ts             # schema/seed/ids/mappers tests
tests/pg-concurrency.test.ts        # opt-in real-Postgres concurrency suite
src/lib/{catalog,admin-posts,orders,admin}.ts   # rewritten data access (same exports)
src/app/api/admin/summary/route.ts  # counts via SQL
src/lib/db.ts, tests/db.test.ts     # DELETED (JSON layer)
```

---

### Task 1: Docker Postgres, dependencies and tooling scaffold

**Files:**
- Create: `docker-compose.yml`, `drizzle.config.ts`
- Modify: `package.json` (deps + scripts), `.env.example`, user's `.env.local` (append `DATABASE_URL`, git-ignored)

**Interfaces:**
- Produces: npm scripts `db:up`, `db:down`, `db:logs`, `db:generate`, `db:migrate`, `db:seed`, `db:reset`, `test:pg`; env var `DATABASE_URL=postgres://rr:rr_dev_password@localhost:5433/rajasthan`; PG test admin URL `postgres://rr:rr_dev_password@localhost:5433/postgres`.

- [ ] **Step 1: Install dependencies** (stable `latest` tags)

```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
npm install drizzle-orm@0.45.4 postgres@3.4.9
npm install -D drizzle-kit@0.31.11 @electric-sql/pglite@0.5.10 tsx@4.23.15
npm ls drizzle-orm drizzle-kit postgres @electric-sql/pglite tsx 2>&1 | grep -E "drizzle|postgres|pglite|tsx"
```
Expected: the five packages listed at the exact versions above.

- [ ] **Step 2: `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: rr-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: rr
      POSTGRES_PASSWORD: rr_dev_password   # local development only
      POSTGRES_DB: rajasthan
    ports:
      - "127.0.0.1:5433:5432"              # 5432 is left free for any locally installed Postgres
    volumes:
      - rr_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rr -d rajasthan"]
      interval: 3s
      timeout: 3s
      retries: 20

volumes:
  rr_pgdata:
```

- [ ] **Step 3: `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

try { process.loadEnvFile('.env.local'); } catch { /* optional */ }

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
```

- [ ] **Step 4: `package.json` scripts** — add inside `"scripts"`:

```json
    "db:up": "docker compose up -d --wait db",
    "db:down": "docker compose down",
    "db:logs": "docker compose logs -f db",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx scripts/db-seed.ts",
    "db:reset": "tsx scripts/db-seed.ts --reset",
    "test:pg": "PG_TEST_URL=postgres://rr:rr_dev_password@localhost:5433/postgres vitest run tests/pg-concurrency.test.ts"
```

- [ ] **Step 5: Env files.** Append to `.env.example`:

```
# Postgres in Docker: `npm run db:up` (localhost:5433; 5432 is left free for any local Postgres).
# These are local-development credentials only.
DATABASE_URL=postgres://rr:rr_dev_password@localhost:5433/rajasthan
```
and add to the user's git-ignored `.env.local` only if missing:
```bash
grep -q '^DATABASE_URL=' .env.local || printf '\nDATABASE_URL=postgres://rr:rr_dev_password@localhost:5433/rajasthan\n' >> .env.local
awk -F= '/^DATABASE_URL/{print $1" -> set"}' .env.local
```
Expected: `DATABASE_URL -> set` (do not print the file).

- [ ] **Step 6: Validate compose and start the database** (requires Docker)

```bash
docker compose config --quiet && echo "compose file valid"
open -a Docker; until docker info >/dev/null 2>&1; do sleep 2; done      # wait for the daemon
npm run db:up
docker compose exec db psql -U rr -d rajasthan -c "select version();" | head -3
lsof -nP -iTCP:5433 -sTCP:LISTEN | tail -1
lsof -nP -iTCP:5432 -sTCP:LISTEN | tail -1
```
Expected: "compose file valid"; `PostgreSQL 16.x`; port 5433 listened by Docker (`com.docker`/`vpnkit`), and the pre-existing local `postgres` still on 5432, untouched. If Docker cannot be started in this environment, run only `docker compose config --quiet` and note "Docker steps deferred" in the ledger; Tasks 2–3 do not need Docker.

- [ ] **Step 7: Commit**
```bash
git add docker-compose.yml drizzle.config.ts package.json package-lock.json .env.example
git commit -m "chore: docker compose Postgres, Drizzle tooling and db scripts"
```

---

### Task 2: Schema, migration, client, mappers, ids, seed library, PGlite test harness

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `src/db/mappers.ts`, `src/db/ids.ts`, `src/db/seed.ts`, `tests/helpers/testdb.ts`, `drizzle/*` (generated), `tests/db-schema.test.ts`

**Interfaces:**
- Produces:
  - `schema.ts` tables: `products`, `workshops`, `orders`, `orderItems`, `bookings`, `idCounters`
  - `client.ts`: `type Database`, `type Tx`, `type Q = Database | Tx`, `getDb(): Database`, `setDb(db: Database | null): void`
  - `mappers.ts`: `toProduct(row): Product`, `toProductRow(p: Omit<Product,'id'>)`, `toWorkshop(row): Workshop`, `toWorkshopRow(w: Omit<Workshop,'id'|'booked'>)`, `toOrder(row, itemRows): Order`, `toBooking(row): Booking`
  - `ids.ts`: `allocateId(q: Q, prefix: 'p' | 'w'): Promise<string>`
  - `seed.ts`: `type LegacyDb`, `truncateAll(db: Database): Promise<void>`, `seedFromJson(db: Database, data: LegacyDb): Promise<{products:number; workshops:number; orders:number; bookings:number}>` (counts of rows actually inserted)
  - `tests/helpers/testdb.ts`: `getTestDb(): Promise<Database>`, `resetTestDb(fixture?: LegacyDb): Promise<Database>` (migrated PGlite, truncated + seeded from `tests/fixtures/db.json`, installed with `setDb`), `snapshot(): Promise<{products: Product[]; workshops: Workshop[]; orders: Order[]; bookings: Booking[]}>`

- [ ] **Step 1: Write `src/db/schema.ts`**

```ts
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  city: text('city').notNull(),
  pricePaise: integer('price_paise').notNull(),
  seller: text('seller').notNull(),
  description: text('description').notNull(),
  stock: integer('stock').notNull(),
  status: text('status').notNull().default('APPROVED'),
  artistName: text('artist_name'),
  instagram: text('instagram'),
  youtube: text('youtube'),
  phone: text('phone'),
  email: text('email'),
  imageUrl: text('image_url'),
}, t => [
  check('products_stock_nonneg', sql`${t.stock} >= 0`),
  check('products_price_nonneg', sql`${t.pricePaise} >= 0`),
  check('products_status_valid', sql`${t.status} in ('APPROVED', 'DRAFT')`),
  index('products_status_idx').on(t.status),
]);

export const workshops = pgTable('workshops', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  pricePaise: integer('price_paise').notNull(),
  city: text('city').notNull(),
  venue: text('venue').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  seats: integer('seats').notNull(),
  booked: integer('booked').notNull().default(0),
  host: text('host').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('APPROVED'),
}, t => [
  check('workshops_type_valid', sql`${t.type} in ('FREE', 'PAID')`),
  check('workshops_price_nonneg', sql`${t.pricePaise} >= 0`),
  check('workshops_seats_positive', sql`${t.seats} >= 1`),
  check('workshops_booked_range', sql`${t.booked} >= 0 and ${t.booked} <= ${t.seats}`),
  check('workshops_status_valid', sql`${t.status} in ('APPROVED', 'DRAFT')`),
  index('workshops_status_idx').on(t.status),
]);

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  userEmail: text('user_email').notNull(),
  customerName: text('customer_name').notNull(),
  email: text('email').notNull(),
  totalPaise: integer('total_paise').notNull(),
  status: text('status').notNull(),
  note: text('note').notNull(),
});

// product_id is intentionally NOT a foreign key: order history must survive deleting a product.
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  name: text('name').notNull(),
  seller: text('seller').notNull(),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  lineTotalPaise: integer('line_total_paise').notNull(),
}, t => [
  check('order_items_quantity_positive', sql`${t.quantity} >= 1`),
  index('order_items_order_idx').on(t.orderId),
]);

// workshop_id is intentionally NOT a foreign key (same reason).
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  userEmail: text('user_email').notNull(),
  workshopId: text('workshop_id').notNull(),
  title: text('title').notNull(),
  attendeeName: text('attendee_name').notNull(),
  email: text('email').notNull(),
  quantity: integer('quantity').notNull(),
  totalPaise: integer('total_paise').notNull(),
  status: text('status').notNull(),
  note: text('note').notNull(),
}, t => [check('bookings_quantity_positive', sql`${t.quantity} >= 1`)]);

// Persisted id counters so a deleted highest id is never handed out again.
export const idCounters = pgTable('id_counters', {
  prefix: text('prefix').primaryKey(),
  value: integer('value').notNull(),
});
```

- [ ] **Step 2: Generate the migration**

```bash
npx drizzle-kit generate --name init
ls drizzle drizzle/meta && grep -c "CREATE TABLE" drizzle/0000_init.sql && grep -c "CONSTRAINT" drizzle/0000_init.sql
```
Expected: `0000_init.sql` + `meta/_journal.json`; 6 `CREATE TABLE`; the check constraints appear (`products_stock_nonneg`, `workshops_booked_range`, …). Commit `drizzle/` (migrations are source).

- [ ] **Step 3: `src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Q = Database | Tx;

let override: Database | null = null;
const g = globalThis as unknown as { __rrDb?: Database };

/** Tests install an in-process PGlite database here; pass null to go back to DATABASE_URL. */
export function setDb(db: Database | null): void { override = db; }

export function getDb(): Database {
  if (override) return override;
  if (g.__rrDb) return g.__rrDb; // survives Next.js dev hot reloads
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run db:up`.');
  const client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  g.__rrDb = drizzle(client, { schema }) as unknown as Database;
  return g.__rrDb;
}
```

- [ ] **Step 4: `src/db/mappers.ts`**

```ts
import type { Booking, Order, OrderItem, Product, Workshop } from '../lib/types';
import type { bookings, orderItems, orders, products, workshops } from './schema';

type ProductRow = typeof products.$inferSelect;
type WorkshopRow = typeof workshops.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type BookingRow = typeof bookings.$inferSelect;

// Optional fields are omitted (never null) so API JSON stays identical to the old JSON-file store.
const opt = <K extends string>(key: K, v: string | null) => (v == null ? {} : { [key]: v }) as Partial<Record<K, string>>;

export const toProduct = (r: ProductRow): Product => ({
  id: r.id, name: r.name, category: r.category, city: r.city, pricePaise: r.pricePaise,
  seller: r.seller, description: r.description, stock: r.stock, status: r.status,
  ...opt('artistName', r.artistName), ...opt('instagram', r.instagram), ...opt('youtube', r.youtube),
  ...opt('phone', r.phone), ...opt('email', r.email), ...opt('imageUrl', r.imageUrl),
});

/** undefined → null so that UPDATE really clears a field (Drizzle ignores undefined keys). */
export const toProductRow = (p: Omit<Product, 'id'>) => ({
  name: p.name, category: p.category, city: p.city, pricePaise: p.pricePaise, seller: p.seller,
  description: p.description, stock: p.stock, status: p.status,
  artistName: p.artistName ?? null, instagram: p.instagram ?? null, youtube: p.youtube ?? null,
  phone: p.phone ?? null, email: p.email ?? null, imageUrl: p.imageUrl ?? null,
});

export const toWorkshop = (r: WorkshopRow): Workshop => ({
  id: r.id, title: r.title, type: r.type as Workshop['type'], pricePaise: r.pricePaise, city: r.city,
  venue: r.venue, date: r.date, time: r.time, seats: r.seats, booked: r.booked, host: r.host,
  description: r.description, status: r.status,
});

export const toWorkshopRow = (w: Omit<Workshop, 'id' | 'booked'>) => ({
  title: w.title, type: w.type, pricePaise: w.pricePaise, city: w.city, venue: w.venue,
  date: w.date, time: w.time, seats: w.seats, host: w.host, description: w.description, status: w.status,
});

const toItem = (i: OrderItemRow): OrderItem => ({
  productId: i.productId, name: i.name, seller: i.seller, quantity: i.quantity,
  unitPricePaise: i.unitPricePaise, lineTotalPaise: i.lineTotalPaise,
});

export const toOrder = (r: OrderRow, items: OrderItemRow[]): Order => ({
  id: r.id, createdAt: r.createdAt.toISOString(), userEmail: r.userEmail, customerName: r.customerName,
  email: r.email, items: items.map(toItem), totalPaise: r.totalPaise, status: r.status, note: r.note,
});

export const toBooking = (r: BookingRow): Booking => ({
  id: r.id, createdAt: r.createdAt.toISOString(), userEmail: r.userEmail, workshopId: r.workshopId,
  title: r.title, attendeeName: r.attendeeName, email: r.email, quantity: r.quantity,
  totalPaise: r.totalPaise, status: r.status, note: r.note,
});
```

- [ ] **Step 5: `src/db/ids.ts`**

```ts
import { sql } from 'drizzle-orm';
import type { Q } from './client';
import { idCounters, products, workshops } from './schema';

/**
 * Atomically allocate the next id ('p5', 'w4', …). The counter row is locked by the upsert, so concurrent
 * callers get distinct ids, and it never goes backwards, so a deleted highest id is never reused.
 * It also self-heals if rows exist beyond the stored counter.
 */
export async function allocateId(q: Q, prefix: 'p' | 'w'): Promise<string> {
  const table = prefix === 'p' ? products : workshops;
  const maxExisting = sql`(select coalesce(max(substring(id from 2)::int), 0) from ${table} where id ~ ${`^${prefix}[0-9]+$`})`;
  const [row] = await q
    .insert(idCounters)
    .values({ prefix, value: sql`${maxExisting} + 1` })
    .onConflictDoUpdate({ target: idCounters.prefix, set: { value: sql`greatest(${idCounters.value}, ${maxExisting}) + 1` } })
    .returning({ value: idCounters.value });
  return `${prefix}${row.value}`;
}
```

- [ ] **Step 6: `src/db/seed.ts`**

```ts
import { sql } from 'drizzle-orm';
import type { Booking, Order, Product, Workshop } from '../lib/types';
import type { Database } from './client';
import { toProductRow, toWorkshopRow } from './mappers';
import { bookings, idCounters, orderItems, orders, products, workshops } from './schema';

/** Shape of data/db.json (the old JSON-file store). */
export type LegacyDb = {
  products: Product[]; workshops: Workshop[]; orders: Order[]; bookings: Booking[];
  counters?: { p?: number; w?: number };
};

export async function truncateAll(db: Database): Promise<void> {
  await db.execute(sql`truncate table order_items, orders, bookings, products, workshops, id_counters restart identity cascade`);
}

const maxNumericId = (prefix: string, ids: string[]) =>
  ids.reduce((m, id) => Math.max(m, Number(new RegExp(`^${prefix}(\\d+)$`).exec(id)?.[1] ?? 0)), 0);

/** Idempotent: existing ids are left untouched. Returns how many rows were actually inserted. */
export async function seedFromJson(db: Database, data: LegacyDb) {
  return db.transaction(async tx => {
    const inserted = { products: 0, workshops: 0, orders: 0, bookings: 0 };

    for (const p of data.products ?? []) {
      const r = await tx.insert(products).values({ id: p.id, ...toProductRow(p) }).onConflictDoNothing().returning({ id: products.id });
      inserted.products += r.length;
    }
    for (const w of data.workshops ?? []) {
      const r = await tx.insert(workshops).values({ id: w.id, ...toWorkshopRow(w), booked: w.booked }).onConflictDoNothing().returning({ id: workshops.id });
      inserted.workshops += r.length;
    }
    for (const o of data.orders ?? []) {
      const r = await tx.insert(orders).values({
        id: o.id, createdAt: new Date(o.createdAt), userEmail: o.userEmail ?? '', customerName: o.customerName,
        email: o.email, totalPaise: o.totalPaise, status: o.status, note: o.note,
      }).onConflictDoNothing().returning({ id: orders.id });
      if (!r.length) continue;
      inserted.orders++;
      if (o.items?.length) {
        await tx.insert(orderItems).values(o.items.map(i => ({
          orderId: o.id, productId: i.productId, name: i.name, seller: i.seller, quantity: i.quantity,
          unitPricePaise: i.unitPricePaise, lineTotalPaise: i.lineTotalPaise,
        })));
      }
    }
    for (const b of data.bookings ?? []) {
      const r = await tx.insert(bookings).values({
        id: b.id, createdAt: new Date(b.createdAt), userEmail: b.userEmail ?? '', workshopId: b.workshopId,
        title: b.title, attendeeName: b.attendeeName, email: b.email, quantity: b.quantity,
        totalPaise: b.totalPaise, status: b.status, note: b.note,
      }).onConflictDoNothing().returning({ id: bookings.id });
      inserted.bookings += r.length;
    }

    for (const [prefix, ids] of [['p', (data.products ?? []).map(p => p.id)], ['w', (data.workshops ?? []).map(w => w.id)]] as const) {
      const value = Math.max(data.counters?.[prefix] ?? 0, maxNumericId(prefix, ids));
      await tx.insert(idCounters).values({ prefix, value })
        .onConflictDoUpdate({ target: idCounters.prefix, set: { value: sql`greatest(${idCounters.value}, ${value})` } });
    }
    return inserted;
  });
}
```

- [ ] **Step 7: PGlite test harness `tests/helpers/testdb.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { asc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { setDb, type Database } from '../../src/db/client';
import { toBooking, toOrder, toProduct, toWorkshop } from '../../src/db/mappers';
import { bookings, orderItems, orders, products, workshops } from '../../src/db/schema';
import * as schema from '../../src/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '../../src/db/seed';

let db: Database | null = null;
const loadFixture = (): LegacyDb => JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/db.json'), 'utf8'));

/** One in-memory Postgres (PGlite) per test file, migrated once. */
export async function getTestDb(): Promise<Database> {
  if (!db) {
    const client = new PGlite();
    const d = drizzle(client, { schema });
    await migrate(d, { migrationsFolder: path.resolve('drizzle') });
    db = d as unknown as Database;
  }
  setDb(db);
  return db;
}

/** Fresh state for every test: truncate everything, reseed from tests/fixtures/db.json. */
export async function resetTestDb(fixture: LegacyDb = loadFixture()): Promise<Database> {
  const d = await getTestDb();
  await truncateAll(d);
  await seedFromJson(d, fixture);
  return d;
}

const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));

/** Whole-database view in domain shapes (replaces the old readDb() in assertions). */
export async function snapshot() {
  const d = await getTestDb();
  const [p, w, o, items, b] = await Promise.all([
    d.select().from(products), d.select().from(workshops),
    d.select().from(orders).orderBy(asc(orders.createdAt), asc(orders.id)),
    d.select().from(orderItems).orderBy(asc(orderItems.id)),
    d.select().from(bookings).orderBy(asc(bookings.createdAt), asc(bookings.id)),
  ]);
  return {
    products: byId(p.map(toProduct)),
    workshops: byId(w.map(toWorkshop)),
    orders: o.map(r => toOrder(r, items.filter(i => i.orderId === r.id))),
    bookings: b.map(toBooking),
  };
}
```

- [ ] **Step 8: Write the failing tests** `tests/db-schema.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb, resetTestDb, snapshot } from './helpers/testdb';
import { seedFromJson, truncateAll, type LegacyDb } from '@/db/seed';
import { allocateId } from '@/db/ids';
import { idCounters, orderItems, orders, products, workshops } from '@/db/schema';
import { toProduct, toProductRow } from '@/db/mappers';

const valid = { name: 'N', category: 'Pottery', city: 'Jaipur', pricePaise: 100, seller: 'S', description: 'D', stock: 1, status: 'APPROVED' };
const fixture = (): LegacyDb => JSON.parse(require('node:fs').readFileSync('tests/fixtures/db.json', 'utf8'));

beforeEach(async () => { await resetTestDb(); });

describe('migrations + fixture seed', () => {
  it('creates the schema and seeds the fixture', async () => {
    const s = await snapshot();
    expect(s.products.map(p => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(s.workshops.map(w => w.id)).toEqual(['w1', 'w2', 'w3']);
    expect(s.orders).toEqual([]);
  });
});

describe('constraints protect the data even if app code is wrong', () => {
  it('rejects negative stock/price, unknown status', async () => {
    const db = await getTestDb();
    for (const bad of [{ stock: -1 }, { pricePaise: -5 }, { status: 'HACK' }])
      await expect(db.insert(products).values({ id: 'x1', ...valid, ...bad })).rejects.toThrow();
    expect((await snapshot()).products).toHaveLength(4);
  });
  it('rejects overbooked or malformed workshops', async () => {
    const db = await getTestDb();
    const w = { id: 'wx', title: 'T', type: 'PAID', pricePaise: 1, city: 'Jaipur', venue: 'V', date: '2026-12-01', time: '10:00', seats: 5, booked: 0, host: 'H', description: 'D', status: 'APPROVED' };
    for (const bad of [{ booked: 6 }, { booked: -1 }, { seats: 0 }, { type: 'MAYBE' }])
      await expect(db.insert(workshops).values({ ...w, ...bad })).rejects.toThrow();
  });
  it('rejects order items with quantity 0', async () => {
    const db = await getTestDb();
    await db.insert(orders).values({ id: 'o1', userEmail: 'a@b.co', customerName: 'A', email: 'a@b.co', totalPaise: 1, status: 'S', note: 'N' });
    await expect(db.insert(orderItems).values({ orderId: 'o1', productId: 'p1', name: 'n', seller: 's', quantity: 0, unitPricePaise: 1, lineTotalPaise: 0 })).rejects.toThrow();
  });
  it('order history survives deleting the product (no foreign key on product_id)', async () => {
    const db = await getTestDb();
    await db.insert(orders).values({ id: 'o1', userEmail: 'a@b.co', customerName: 'A', email: 'a@b.co', totalPaise: 1, status: 'S', note: 'N' });
    await db.insert(orderItems).values({ orderId: 'o1', productId: 'p1', name: 'Crochet Lily Bouquet', seller: 's', quantity: 1, unitPricePaise: 1, lineTotalPaise: 1 });
    await db.delete(products).where(eq(products.id, 'p1'));
    expect((await snapshot()).orders[0].items[0].name).toBe('Crochet Lily Bouquet');
  });
});

describe('seedFromJson is idempotent and keeps counters', () => {
  it('second run inserts nothing and changes nothing', async () => {
    const db = await getTestDb();
    const again = await seedFromJson(db, fixture());
    expect(again).toEqual({ products: 0, workshops: 0, orders: 0, bookings: 0 });
    expect((await snapshot()).products).toHaveLength(4);
  });
  it('sets counters from existing ids so the next id continues the sequence', async () => {
    const db = await getTestDb();
    expect(await allocateId(db, 'p')).toBe('p5');
    expect(await allocateId(db, 'p')).toBe('p6');
    expect(await allocateId(db, 'w')).toBe('w4');
  });
  it('honours a larger legacy counter (a deleted highest id is never reused)', async () => {
    const db = await resetTestDb({ ...fixture(), counters: { p: 9 } });
    expect(await allocateId(db, 'p')).toBe('p10');
  });
  it('re-seeding never lowers a counter', async () => {
    const db = await resetTestDb({ ...fixture(), counters: { p: 9 } });
    await seedFromJson(db, fixture());
    expect(await allocateId(db, 'p')).toBe('p10');
  });
  it('imports legacy orders with items and bookings; missing userEmail becomes empty', async () => {
    const legacy: LegacyDb = {
      ...fixture(),
      orders: [{ id: 'o-1', createdAt: '2026-10-01T10:00:00.000Z', customerName: 'C', email: 'c@x.co', items: [
        { productId: 'p1', name: 'A', seller: 'S', quantity: 2, unitPricePaise: 5, lineTotalPaise: 10 },
        { productId: 'p2', name: 'B', seller: 'S', quantity: 1, unitPricePaise: 7, lineTotalPaise: 7 }], totalPaise: 17, status: 'DEMO_ORDER_CREATED', note: 'n' } as any],
      bookings: [{ id: 'b-1', createdAt: '2026-10-02T10:00:00.000Z', workshopId: 'w1', title: 'T', attendeeName: 'A', email: 'a@x.co', quantity: 1, totalPaise: 0, status: 'S', note: 'n' } as any],
    };
    const db = await resetTestDb(legacy);
    const s = await snapshot();
    expect(s.orders).toHaveLength(1);
    expect(s.orders[0]).toMatchObject({ id: 'o-1', userEmail: '', createdAt: '2026-10-01T10:00:00.000Z' });
    expect(s.orders[0].items.map(i => i.productId)).toEqual(['p1', 'p2']);
    expect(s.bookings[0]).toMatchObject({ id: 'b-1', userEmail: '' });
    await truncateAll(db);
    expect((await snapshot()).products).toEqual([]);
  });
});

describe('allocateId', () => {
  it('is safe when the counter row is missing but rows exist, and under parallel callers', async () => {
    const db = await getTestDb();
    await db.delete(idCounters);
    const ids = await Promise.all(Array.from({ length: 20 }, () => db.transaction(tx => allocateId(tx, 'p'))));
    expect(new Set(ids).size).toBe(20);
    expect(ids.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0]).toBe('p5');
  });
});

describe('mappers', () => {
  it('omit unset optional fields (no nulls leak into JSON) and round-trip', async () => {
    const db = await getTestDb();
    const [row] = await db.select().from(products).where(eq(products.id, 'p2'));
    expect(row.instagram).toBeNull();
    const p = toProduct(row);
    expect('instagram' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('null');
    expect(toProductRow(p).instagram).toBeNull();
  });
});
```
(`require('node:fs')` inside the test is acceptable under Vitest; if the linter objects, replace with a top-level `import fs from 'node:fs'`.)

- [ ] **Step 9: Run to verify RED** — `npx vitest run tests/db-schema.test.ts`. Expected: FAIL only because the files from Steps 1–7 did not exist yet when the test was first run. (If you wrote Steps 1–7 first, temporarily `git stash` `src/db` + `tests/helpers` and confirm the failure "Cannot find package '@/db/seed'", then restore. The tests must be seen failing before the implementation exists.)

- [ ] **Step 10: Run to verify GREEN** — `npx vitest run tests/db-schema.test.ts` then `npx tsc --noEmit -p tsconfig.json`.
Expected: all `db-schema` tests PASS; no type errors (if `Database`/`Tx` assignability complains, keep the `as unknown as Database` casts shown in `client.ts`/`testdb.ts` and do not weaken any other types). The full suite is untouched and still green (nothing imports `src/db` yet).

- [ ] **Step 11: Commit**
```bash
git add src/db drizzle tests/helpers tests/db-schema.test.ts
git commit -m "feat: Drizzle schema, migration, client, mappers, id allocator, seed library, PGlite harness"
```

---

### Task 3: Port the data layer to Postgres (atomic swap)

The five data modules share tables (orders change product stock; admin edits change what the catalog shows), so they are ported together. Work module by module in the order below; **commit once at the end**. Between modules, only that module's own test file needs to pass; the cross-module API tests (`api`, `admin-api`, `admin-posts-api`) are migrated in Step 8 and the **whole suite must be green** before committing.

**Files:**
- Modify (rewrite data access, same exports): `src/lib/catalog.ts`, `src/lib/admin-posts.ts`, `src/lib/orders.ts`, `src/lib/admin.ts`, `src/app/api/admin/summary/route.ts`
- Delete: `src/lib/db.ts`, `tests/db.test.ts`
- Modify (tests): `tests/catalog.test.ts`, `tests/admin.test.ts`, `tests/orders.test.ts`, `tests/admin-posts.test.ts`, `tests/api.test.ts`, `tests/admin-api.test.ts`, `tests/admin-posts-api.test.ts`

**Interfaces:**
- Consumes: Task 2 (`getDb`, schema tables, mappers, `allocateId`, test harness). Existing pure helpers stay untouched: `validateProduct`/`validateWorkshop`/`pick`/`obj` in `admin.ts`, `artistKey`, `productSlug`, `workshopSlug`.
- Produces: identical exports as listed in Global Constraints.

- [ ] **Step 1: Migrate test plumbing with one script** (turns every JSON-file test setup into `await resetTestDb()` and `readDb` into the harness `snapshot`):

```bash
python3 - <<'EOF'
import re, pathlib
files = ['catalog','admin','orders','admin-posts','api','admin-api','admin-posts-api']
block = re.compile(r"  const dir = fs\.mkdtempSync\([^\n]*\n  const file = [^\n]*\n  fs\.copyFileSync\([^\n]*\n  process\.env\.DB_PATH = file;")
for name in files:
    p = pathlib.Path(f'tests/{name}.test.ts'); s = p.read_text()
    s = block.sub("  await resetTestDb();", s)
    s = s.replace("beforeEach(() => {", "beforeEach(async () => {")
    uses_read = 'readDb' in s
    s = re.sub(r"import \{ readDb \} from '@/lib/db';\n", "", s)
    imp = "import { resetTestDb, snapshot as readDb } from './helpers/testdb';\n" if uses_read else "import { resetTestDb } from './helpers/testdb';\n"
    # insert after the last top-level import line
    lines = s.split('\n'); last = max(i for i,l in enumerate(lines) if l.startswith('import '))
    lines.insert(last+1, imp.rstrip('\n')); s = '\n'.join(lines)
    for mod, ident in (('node:fs','fs'),('node:os','os'),('node:path','path')):
        body = s.replace(f"import {ident} from '{mod}';\n", "")
        if not re.search(rf"\b{ident}\.", body): s = body
    p.write_text(s)
pathlib.Path('tests/db.test.ts').unlink()
EOF
sed -i '' "/\.counters).toBeUndefined()/d" tests/admin.test.ts
sed -i '' "s/still works on a database without counters (legacy shape)/continues the sequence from existing ids when seeded without counters/" tests/admin.test.ts
git rm -q --cached tests/db.test.ts 2>/dev/null; grep -ln "DB_PATH\|lib/db'" tests/*.ts tests/*.tsx
```
Expected: the final `grep` prints nothing. Run `npx vitest run tests/catalog.test.ts` — Expected: **FAIL/ERROR** now (modules still use the JSON layer, which no longer has a `DB_PATH`): this is the RED state for the port.

- [ ] **Step 2: Add the new tests first (RED)** — append to `tests/catalog.test.ts`:

```ts
import { getTestDb } from './helpers/testdb';
import { products as productsTable } from '@/db/schema';

describe('search text is a literal, injection-safe substring match', () => {
  const extra = { category: 'Pottery', city: 'Jaipur', pricePaise: 100, seller: 'Odd Seller', stock: 1, status: 'APPROVED' };
  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(productsTable).values([
      { id: 'p91', name: 'Rock 100% Cotton', description: 'soft', ...extra },
      { id: 'p92', name: 'Under_score Dish', description: 'plain', ...extra },
      { id: 'p93', name: 'Back\\slash Bowl', description: 'plain', ...extra },
    ]);
  });
  it('treats % _ and \\ literally', async () => {
    expect((await listProducts({ q: '100%' })).map(p => p.id)).toEqual(['p91']);
    expect((await listProducts({ q: '%' })).map(p => p.id)).toEqual(['p91']);
    expect((await listProducts({ q: '_' })).map(p => p.id)).toEqual(['p92']);
    expect((await listProducts({ q: '\\' })).map(p => p.id)).toEqual(['p93']);
  });
  it('quotes and SQL fragments are just text; tables stay intact', async () => {
    expect(await listProducts({ q: "'; drop table products; --" })).toEqual([]);
    expect(await listProducts({ q: "' or '1'='1" })).toEqual([]);
    expect((await listProducts()).length).toBe(7);
  });
  it('a 10 000 character query returns an empty list instead of failing', async () => {
    expect(await listProducts({ q: 'x'.repeat(10_000) })).toEqual([]);
  });
  it('matching is still case-insensitive and ordered by id (p2 before p10)', async () => {
    expect((await listProducts({ q: 'FLOWER' })).map(p => p.id)).toEqual(['p1', 'p3']);
    const db = await getTestDb();
    await db.insert(productsTable).values({ id: 'p10', name: 'Ten', description: 'd', ...extra });
    const ids = (await listProducts()).map(p => p.id);
    expect(ids.indexOf('p2')).toBeLessThan(ids.indexOf('p10'));
  });
});
```
and in `tests/catalog.test.ts` make sure `beforeEach` import exists (it does). Append to `tests/admin.test.ts`:

```ts
import { getTestDb } from './helpers/testdb';
import { products as productsTable } from '@/db/schema';

describe('clearing optional product fields writes NULL and never leaks null into JSON', () => {
  it('PATCH with empty/blank strings clears the columns', async () => {
    await updateProduct('p1', { instagram: 'shaukandstuff', phone: '9997979999', imageUrl: 'https://cdn.example.com/a.jpg' });
    const p = await updateProduct('p1', { instagram: '', phone: '   ', imageUrl: '' });
    expect('instagram' in p).toBe(false);
    expect('phone' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('null');
    const db = await getTestDb();
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, 'p1'));
    expect(row.instagram).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.imageUrl).toBeNull();
  });
  it('failed validation leaves the row untouched', async () => {
    await expect(updateProduct('p1', { stock: -3 })).rejects.toMatchObject({ status: 400 });
    expect((await readDb()).products[0].stock).toBe(8);
  });
});
```
(add `import { eq } from 'drizzle-orm';` at the top of the file). Append to `tests/orders.test.ts`:

```ts
import { deleteProduct } from '@/lib/admin';

describe('order input edge cases', () => {
  it('a non-string productId never matches a product (array/number/object → 400)', async () => {
    for (const productId of [['p1'], 1, { id: 'p1' }, null]) {
      await expect(createOrder({ items: [{ productId, quantity: 1 }] }, 'a@b.co')).rejects.toMatchObject({ status: 400 });
    }
    expect((await readDb()).products[0].stock).toBe(8);
  });
  it('past orders keep their item details after the product is deleted', async () => {
    const o = await createOrder({ items: [{ productId: 'p2', quantity: 2 }] }, 'a@b.co');
    await deleteProduct('p2');
    const mine = await listOrders({ email: 'a@b.co', role: 'customer' });
    expect(mine.find(x => x.id === o.id)!.items[0]).toMatchObject({ productId: 'p2', name: 'Pichola Boat Bag Charm', quantity: 2 });
  });
  it('a failed order inside the transaction rolls back every earlier stock change', async () => {
    await expect(createOrder({ items: [{ productId: 'p1', quantity: 2 }, { productId: 'p3', quantity: 99 }] }, 'a@b.co')).rejects.toMatchObject({ status: 400 });
    const s = await readDb();
    expect(s.products.find(p => p.id === 'p1')!.stock).toBe(8);
    expect(s.orders).toHaveLength(0);
  });
});
```
(the file already imports `listOrders`? — it imports `createOrder, createBooking, listOrders, listBookings` for the ownership tests; if `listOrders` is not imported in this file add it to the `@/lib/orders` import.)

Run `npx vitest run tests/catalog.test.ts tests/admin.test.ts tests/orders.test.ts tests/admin-posts.test.ts` — Expected: FAIL (modules not yet ported). Record that these are the RED tests.

- [ ] **Step 3: Port `src/lib/catalog.ts`** — replace the file's data part (keep the top `export { CITIES, … } from './catalog-shared';` re-export and types `ProductFilter`/`WorkshopFilter`):

```ts
import { and, asc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toProduct, toWorkshop } from '../db/mappers';
import { products as productsT, workshops as workshopsT } from '../db/schema';
import { productSlug, workshopSlug } from './catalog-shared';
import type { Product, Workshop } from './types';

export { CITIES, CATEGORIES, citySlug, cityFromSlug, productSlug, workshopSlug } from './catalog-shared';

export type ProductFilter = { city?: string; category?: string; q?: string };
export type WorkshopFilter = { city?: string; type?: string; q?: string };

const anyCity = (c?: string) => !c || c === 'All Rajasthan';
/** Escape LIKE metacharacters so user text is matched literally (backslash is Postgres' default LIKE escape). */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);
const idOrder = (t: { id: typeof productsT.id | typeof workshopsT.id }) => [sql`length(${t.id})`, asc(t.id)] as const;

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  const where: SQL[] = [eq(productsT.status, 'APPROVED')];
  if (!anyCity(f.city)) where.push(eq(productsT.city, f.city!));
  if (f.category && f.category !== 'All categories') where.push(eq(productsT.category, f.category));
  if (f.q) where.push(ilike(sql`concat_ws(' ', ${productsT.name}, ${productsT.description}, ${productsT.seller}, ${productsT.category})`, `%${escapeLike(f.q)}%`));
  const rows = await getDb().select().from(productsT).where(and(...where)).orderBy(...idOrder(productsT));
  return rows.map(toProduct);
}

export async function listWorkshops(f: WorkshopFilter = {}): Promise<Workshop[]> {
  const where: SQL[] = [eq(workshopsT.status, 'APPROVED')];
  if (!anyCity(f.city)) where.push(eq(workshopsT.city, f.city!));
  if (f.type && f.type !== 'ALL') where.push(eq(workshopsT.type, f.type));
  if (f.q) where.push(ilike(sql`concat_ws(' ', ${workshopsT.title}, ${workshopsT.description}, ${workshopsT.venue}, ${workshopsT.host})`, `%${escapeLike(f.q)}%`));
  const rows = await getDb().select().from(workshopsT).where(and(...where)).orderBy(...idOrder(workshopsT));
  return rows.map(toWorkshop);
}

/** slug = "<name>-<id>": look the id up directly, then require the exact slug (wrong name part → undefined). */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^p\d+$/.test(id)) return undefined;
  const [row] = await getDb().select().from(productsT).where(and(eq(productsT.id, id), eq(productsT.status, 'APPROVED')));
  const p = row && toProduct(row);
  return p && productSlug(p) === slug ? p : undefined;
}

export async function getWorkshopBySlug(slug: string): Promise<Workshop | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^w\d+$/.test(id)) return undefined;
  const [row] = await getDb().select().from(workshopsT).where(and(eq(workshopsT.id, id), eq(workshopsT.status, 'APPROVED')));
  const w = row && toWorkshop(row);
  return w && workshopSlug(w) === slug ? w : undefined;
}
```
Run `npx vitest run tests/catalog.test.ts` — Expected: PASS (existing + new search tests).

- [ ] **Step 4: Port `src/lib/admin-posts.ts`** — full file:

```ts
import { and, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toProduct } from '../db/mappers';
import { products } from '../db/schema';
import { artistKey } from './artist';
import { ApiError } from './errors';
import type { Product } from './types';

export { artistKey };
export type AdminArtist = { key: string; name: string; total: number; published: number; drafts: number };
export type AdminProductQuery = { artist?: string; status?: string; q?: string };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);
// Same normalisation as artistKey(): collapse whitespace, trim, lowercase.
const cleanSeller = sql`btrim(regexp_replace(${products.seller}, '\\s+', ' ', 'g'))`;
const keySql = sql`lower(${cleanSeller})`;

export async function listProductsForAdmin(f: AdminProductQuery = {}): Promise<Product[]> {
  const where: SQL[] = [];
  if (f.artist) where.push(sql`${keySql} = ${artistKey(f.artist)}`);
  if (f.status) where.push(eq(products.status, f.status));
  const q = (f.q ?? '').trim();
  if (q) where.push(ilike(sql`concat_ws(' ', ${products.name}, ${products.description}, ${products.seller}, ${products.category})`, `%${escapeLike(q)}%`));
  const rows = await getDb().select().from(products).where(and(...where))
    .orderBy(sql`length(${products.id}) desc`, sql`${products.id} desc`);
  return rows.map(toProduct);
}

export async function getProductForAdmin(id: string): Promise<Product> {
  const [row] = await getDb().select().from(products).where(eq(products.id, id));
  if (!row) throw new ApiError(404, 'Product not found.');
  return toProduct(row);
}

export async function listArtists(): Promise<AdminArtist[]> {
  const rows = await getDb().select({
    key: sql<string>`${keySql}`,
    // label = the first-created post's seller text (same rule as before)
    name: sql<string>`(array_agg(${cleanSeller} order by length(${products.id}), ${products.id}))[1]`,
    total: sql<number>`count(*)`.mapWith(Number),
    published: sql<number>`count(*) filter (where ${products.status} = 'APPROVED')`.mapWith(Number),
  }).from(products).groupBy(keySql);
  return rows
    .map(r => ({ key: r.key, name: r.name, total: r.total, published: r.published, drafts: r.total - r.published }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```
Run `npx vitest run tests/admin-posts.test.ts` — Expected: PASS.

- [ ] **Step 5: Port `src/lib/orders.ts`** — full file:

```ts
import crypto from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toBooking, toOrder } from '../db/mappers';
import { bookings as bookingsT, orderItems as orderItemsT, orders as ordersT, products as productsT, workshops as workshopsT } from '../db/schema';
import type { SessionUser } from './authz';
import { ApiError } from './errors';
import type { Booking, Order } from './types';

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback: string, max: number) => String(v ?? fallback).slice(0, max) || fallback;
const STOCK_ERROR = 'A product is unavailable or quantity exceeds stock.';

export async function createOrder(input: unknown, userEmail: string): Promise<Order> {
  const b = (input ?? {}) as Raw;
  if (!Array.isArray(b.items) || !b.items.length) throw new ApiError(400, 'Add at least one item.');
  if (b.items.some(i => !i || typeof i !== 'object' || Array.isArray(i))) throw new ApiError(400, STOCK_ERROR);
  const reqItems = b.items as Raw[];
  const wanted = [...new Set(reqItems.map(i => (typeof i.productId === 'string' ? i.productId : '')).filter(Boolean))];

  return getDb().transaction(async tx => {
    // Lock the involved products in a fixed order (id) so concurrent orders serialise instead of deadlocking.
    const rows = wanted.length
      ? await tx.select().from(productsT)
          .where(and(inArray(productsT.id, wanted), eq(productsT.status, 'APPROVED')))
          .orderBy(asc(productsT.id)).for('update')
      : [];
    const byId = new Map(rows.map(r => [r.id, r]));

    const items = reqItems.map(i => {
      const p = typeof i.productId === 'string' ? byId.get(i.productId) : undefined;
      const qty = Number(i.quantity);
      if (!p || !Number.isInteger(qty) || qty < 1 || qty > p.stock) throw new ApiError(400, STOCK_ERROR);
      return { productId: p.id, name: p.name, seller: p.seller, quantity: qty, unitPricePaise: p.pricePaise, lineTotalPaise: p.pricePaise * qty };
    });
    // same product listed twice: re-check the combined quantity
    const totals = new Map<string, number>();
    for (const it of items) totals.set(it.productId, (totals.get(it.productId) ?? 0) + it.quantity);
    for (const [id, qty] of totals) if (qty > byId.get(id)!.stock) throw new ApiError(400, STOCK_ERROR);

    const [orderRow] = await tx.insert(ordersT).values({
      id: crypto.randomUUID(),
      userEmail,
      customerName: str(b.customerName, 'Demo Customer', 100),
      email: String(b.email ?? '').slice(0, 200),
      totalPaise: items.reduce((s, i) => s + i.lineTotalPaise, 0),
      status: 'DEMO_ORDER_CREATED',
      note: 'Demo only: no payment has been collected.',
    }).returning();
    const itemRows = await tx.insert(orderItemsT).values(items.map(i => ({ orderId: orderRow.id, ...i }))).returning();
    for (const [id, qty] of totals)
      await tx.update(productsT).set({ stock: sql`${productsT.stock} - ${qty}` }).where(eq(productsT.id, id));
    return toOrder(orderRow, itemRows);
  });
}

export async function createBooking(input: unknown, userEmail: string): Promise<Booking> {
  const b = (input ?? {}) as Raw;
  const qty = Number(b.quantity ?? 1);
  const workshopId = typeof b.workshopId === 'string' ? b.workshopId : '';

  return getDb().transaction(async tx => {
    const [w] = await tx.select().from(workshopsT)
      .where(and(eq(workshopsT.id, workshopId), eq(workshopsT.status, 'APPROVED'))).for('update');
    if (!w) throw new ApiError(404, 'Workshop not found.');
    if (!Number.isInteger(qty) || qty < 1 || qty > w.seats - w.booked) throw new ApiError(409, 'Not enough seats remaining.');
    const free = w.type === 'FREE';
    const [row] = await tx.insert(bookingsT).values({
      id: crypto.randomUUID(),
      userEmail,
      workshopId: w.id,
      title: w.title,
      attendeeName: str(b.attendeeName, 'Demo Guest', 100),
      email: String(b.email ?? '').slice(0, 200),
      quantity: qty,
      totalPaise: w.pricePaise * qty,
      status: free ? 'CONFIRMED_FREE_DEMO' : 'DEMO_BOOKING_CREATED',
      note: free ? 'Free demo booking confirmed; no payment required.' : 'Demo only: no payment has been collected.',
    }).returning();
    await tx.update(workshopsT).set({ booked: sql`${workshopsT.booked} + ${qty}` }).where(eq(workshopsT.id, w.id));
    return toBooking(row);
  });
}

const ownerFilter = (u: SessionUser, col: typeof ordersT.userEmail | typeof bookingsT.userEmail) =>
  u.role === 'admin' ? undefined : sql`lower(${col}) = ${u.email.toLowerCase()}`;

export async function listOrders(u: SessionUser): Promise<Order[]> {
  const db = getDb();
  const rows = await db.select().from(ordersT).where(ownerFilter(u, ordersT.userEmail)).orderBy(asc(ordersT.createdAt), asc(ordersT.id));
  if (!rows.length) return [];
  const items = await db.select().from(orderItemsT).where(inArray(orderItemsT.orderId, rows.map(r => r.id))).orderBy(asc(orderItemsT.id));
  return rows.map(r => toOrder(r, items.filter(i => i.orderId === r.id)));
}

export async function listBookings(u: SessionUser): Promise<Booking[]> {
  const rows = await getDb().select().from(bookingsT).where(ownerFilter(u, bookingsT.userEmail)).orderBy(asc(bookingsT.createdAt), asc(bookingsT.id));
  return rows.map(toBooking);
}
```
Run `npx vitest run tests/orders.test.ts` — Expected: PASS (including concurrency tests, rollback test and edge cases).

- [ ] **Step 6: Port `src/lib/admin.ts`** — keep every pure helper (`bad`, `obj`, `text`, `int`, `oneOf`, `optionalText`, `optionalImageUrl`, `pick`, `validateProduct`, `validDate`, `validateWorkshop`, key lists). Replace the first imports and delete `nextId`, then replace everything from `export async function createProduct` to the end of the file:

```ts
// --- top of file: replace the import block with ---
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { allocateId } from '../db/ids';
import { toProduct, toProductRow, toWorkshop, toWorkshopRow } from '../db/mappers';
import { products as productsT, workshops as workshopsT } from '../db/schema';
import { ApiError } from './errors';
import { CATEGORIES, CITIES } from './catalog';
import type { Product, Workshop } from './types';
// --- delete the old `nextId(...)` function (ids now come from allocateId in SQL) ---

// --- replace from `export async function createProduct` to EOF with ---
export async function createProduct(input: unknown): Promise<Product> {
  const data = validateProduct(pick(obj(input), PRODUCT_KEYS));
  return getDb().transaction(async tx => {
    const id = await allocateId(tx, 'p');
    const [row] = await tx.insert(productsT).values({ id, ...toProductRow(data) }).returning();
    return toProduct(row);
  });
}

export async function updateProduct(id: string, input: unknown): Promise<Product> {
  const patch = pick(obj(input), PRODUCT_KEYS);
  return getDb().transaction(async tx => {
    const [row] = await tx.select().from(productsT).where(eq(productsT.id, id)).for('update');
    if (!row) throw new ApiError(404, 'Product not found.');
    const next = validateProduct({ ...toProduct(row), ...patch });
    const [saved] = await tx.update(productsT).set(toProductRow(next)).where(eq(productsT.id, id)).returning();
    return toProduct(saved);
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const rows = await getDb().delete(productsT).where(eq(productsT.id, id)).returning({ id: productsT.id });
  if (!rows.length) throw new ApiError(404, 'Product not found.');
}

export async function createWorkshop(input: unknown): Promise<Workshop> {
  const data = validateWorkshop({ ...pick(obj(input), WORKSHOP_KEYS), status: undefined });
  return getDb().transaction(async tx => {
    const id = await allocateId(tx, 'w');
    const [row] = await tx.insert(workshopsT).values({ id, ...toWorkshopRow(data), booked: 0 }).returning();
    return toWorkshop(row);
  });
}

export async function updateWorkshop(id: string, input: unknown): Promise<Workshop> {
  const patch = pick(obj(input), WORKSHOP_KEYS);
  return getDb().transaction(async tx => {
    const [row] = await tx.select().from(workshopsT).where(eq(workshopsT.id, id)).for('update');
    if (!row) throw new ApiError(404, 'Workshop not found.');
    const next = validateWorkshop({ ...toWorkshop(row), ...patch });
    if (next.seats < row.booked) throw bad(`seats cannot be less than the ${row.booked} already booked.`);
    const [saved] = await tx.update(workshopsT).set(toWorkshopRow(next)).where(eq(workshopsT.id, id)).returning();
    return toWorkshop(saved);
  });
}

export async function deleteWorkshop(id: string): Promise<void> {
  const rows = await getDb().delete(workshopsT).where(eq(workshopsT.id, id)).returning({ id: workshopsT.id });
  if (!rows.length) throw new ApiError(404, 'Workshop not found.');
}
```
Run `npx vitest run tests/admin.test.ts` — Expected: PASS (ids never reused, clearing optional fields, concurrent creates unique, seats/booked rules).

- [ ] **Step 7: Port the summary route** `src/app/api/admin/summary/route.ts`:

```ts
import { count } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb } from '@/db/client';
import { bookings, orders, products, workshops } from '@/db/schema';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  const db = getDb();
  const [[p], [w], [o], [b]] = await Promise.all([
    db.select({ n: count() }).from(products), db.select({ n: count() }).from(workshops),
    db.select({ n: count() }).from(orders), db.select({ n: count() }).from(bookings),
  ]);
  return json({ products: p.n, workshops: w.n, orders: o.n, bookings: b.n, note: 'Demo summary; admin-only.' });
});
```

- [ ] **Step 8: Remove the JSON layer and run everything**

```bash
git rm -q src/lib/db.ts
grep -rn "lib/db'\|from './db'\|DB_PATH\|mutateDb\|readDb" src tests scripts | grep -v "snapshot as readDb\|tests/helpers" || echo "no JSON-layer references left"
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/dev" | head
npx vitest run 2>&1 | grep -E "Tests |Test Files|×|FAIL"
```
Expected: "no JSON-layer references left" (the harness alias `readDb` in tests is fine); no type errors from our code (ignore a stale `.next/dev/types/validator.ts` error caused by a running `next dev`, see Environment facts); **all tests pass** (≈170: the previous 157 minus the deleted JSON-layer tests plus the new ones). Mutation spot-check (then revert): in `createOrder` delete the `.for('update')` call → the suite stays green on PGlite (expected; the lock is proven in Task 4); in `listProducts` delete `escapeLike(...)` → the new search tests must FAIL.

- [ ] **Step 9: Commit**
```bash
git add -A
git commit -m "feat: port data layer from JSON file to Postgres (Drizzle), tests on PGlite"
```

---

### Task 4: Real-Postgres concurrency suite, seed CLI, docs and live verification

**Files:**
- Create: `tests/pg-concurrency.test.ts`, `scripts/db-seed.ts`
- Modify: `README.md`, `scripts/seo-check.mjs` (no change needed unless it hard-codes the file store; verify)

**Interfaces:**
- Consumes: everything above; Docker Postgres from Task 1 (`npm run db:up`).
- Produces: `npm run db:seed`, `npm run db:reset`, `npm run test:pg`.

- [ ] **Step 1: Write the opt-in real-Postgres test** `tests/pg-concurrency.test.ts` (skipped unless `PG_TEST_URL` is set):

```ts
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { setDb, type Database } from '@/db/client';
import * as schema from '@/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '@/db/seed';
import { createBooking, createOrder } from '@/lib/orders';
import { createProduct, createWorkshop } from '@/lib/admin';

const adminUrl = process.env.PG_TEST_URL;
const fixture: LegacyDb = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/db.json'), 'utf8'));
const ok = <T,>(rs: PromiseSettledResult<T>[]) => rs.filter(r => r.status === 'fulfilled').length;
const product = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, seller: 'Marwar Lac', description: 'Hand-set.', stock: 3 };

describe.skipIf(!adminUrl)('real Postgres: concurrency and locking', () => {
  const dbName = `rr_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let admin: ReturnType<typeof postgres>;
  let client: ReturnType<typeof postgres>;
  let db: Database;

  beforeAll(async () => {
    admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`create database ${dbName}`);
    const url = new URL(adminUrl!); url.pathname = `/${dbName}`;
    client = postgres(url.toString(), { max: 25 });
    db = drizzle(client, { schema }) as unknown as Database;
    await migrate(db as never, { migrationsFolder: path.resolve('drizzle') });
    setDb(db);
  });
  afterAll(async () => {
    setDb(null);
    await client?.end();
    await admin?.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });
  beforeEach(async () => { await truncateAll(db); await seedFromJson(db, fixture); });

  it('25 parallel orders for a product with stock 5: exactly 5 succeed, stock ends at 0', async () => {
    const rs = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => createOrder({ items: [{ productId: 'p3', quantity: 1 }] }, `u${i}@x.co`)));
    expect(ok(rs)).toBe(5);
    const [p3] = await db.select().from(schema.products).where((await import('drizzle-orm')).eq(schema.products.id, 'p3'));
    expect(p3.stock).toBe(0);
    expect((await db.select().from(schema.orders)).length).toBe(5);
  });

  it('20 parallel bookings of 1 seat on w1 (12 seats, 3 booked): exactly 9 succeed and booked never exceeds seats', async () => {
    const rs = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => createBooking({ workshopId: 'w1', quantity: 1 }, `u${i}@x.co`)));
    expect(ok(rs)).toBe(9);
    const [w1] = await db.select().from(schema.workshops).where((await import('drizzle-orm')).eq(schema.workshops.id, 'w1'));
    expect(w1.booked).toBe(12);
  });

  it('two parallel orders that each list the same product twice (3 + 2 of stock 5) cannot oversell', async () => {
    const body = { items: [{ productId: 'p3', quantity: 3 }, { productId: 'p3', quantity: 2 }] };
    const rs = await Promise.allSettled([createOrder(body, 'a@x.co'), createOrder(body, 'b@x.co')]);
    expect(ok(rs)).toBe(1);
  });

  it('orders listing the same products in opposite orders all complete (no deadlock)', async () => {
    const a = { items: [{ productId: 'p1', quantity: 1 }, { productId: 'p3', quantity: 1 }] };
    const b = { items: [{ productId: 'p3', quantity: 1 }, { productId: 'p1', quantity: 1 }] };
    const rs = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => createOrder(i % 2 ? a : b, `u${i}@x.co`)));
    expect(rs.filter(r => r.status === 'rejected' && !/unavailable|exceeds/.test(String((r as PromiseRejectedResult).reason?.message))).length).toBe(0);
    expect(ok(rs)).toBe(5); // p3 has stock 5
  });

  it('50 parallel product creates and 20 workshop creates get unique, gap-free-or-increasing ids', async () => {
    const ps = await Promise.all(Array.from({ length: 50 }, () => createProduct(product)));
    expect(new Set(ps.map(p => p.id)).size).toBe(50);
    const ws = await Promise.all(Array.from({ length: 20 }, () => createWorkshop({ title: 'T', type: 'FREE', pricePaise: 0, city: 'Jaipur', venue: 'V', date: '2026-12-01', time: '10:00', seats: 5, host: 'H', description: 'D' })));
    expect(new Set(ws.map(w => w.id)).size).toBe(20);
  });
});
```
- [ ] **Step 2: Run it without Docker — must skip, not fail:** `npx vitest run tests/pg-concurrency.test.ts` — Expected: `1 skipped` file (all tests skipped).

- [ ] **Step 3: Seed CLI** `scripts/db-seed.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Database } from '../src/db/client';
import * as schema from '../src/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '../src/db/seed';

try { process.loadEnvFile('.env.local'); } catch { /* optional */ }

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run db:up`.'); process.exit(1); }

const reset = process.argv.includes('--reset');
const file = path.resolve('data/db.json');
const data: LegacyDb = JSON.parse(fs.readFileSync(file, 'utf8'));

const client = postgres(url, { max: 1, connect_timeout: 10 });
const db = drizzle(client, { schema }) as unknown as Database;
try {
  if (reset) { await truncateAll(db); console.log('Truncated all tables.'); }
  const inserted = await seedFromJson(db, data);
  console.log(`Seeded from ${path.relative(process.cwd(), file)}:`, inserted);
} catch (e) {
  console.error('Seeding failed:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
```

- [ ] **Step 4: Bring the real stack up and run the real-Postgres suite** (requires Docker; start it with `open -a Docker` and wait for `docker info`):

```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
npm run db:up
npm run db:migrate 2>&1 | tail -3
npm run db:seed 2>&1 | tail -2          # Expected: Seeded from data/db.json: { products: 4, workshops: 3, orders: 0, bookings: 0 }
npm run db:seed 2>&1 | tail -1          # Expected (idempotent): { products: 0, workshops: 0, orders: 0, bookings: 0 }
npm run test:pg 2>&1 | grep -E "Tests |✓|×|FAIL"    # Expected: 5 passed
docker compose exec db psql -U rr -d rajasthan -c "select id, value from id_counters;"     # Expected: p|4 and w|3
```
If `test:pg` fails on a concurrency assertion, that is a real locking bug: fix `createOrder`/`createBooking`/`allocateId`, do not weaken the test. Mutation check: temporarily remove `.for('update')` from `createOrder` and re-run `npm run test:pg` — Expected: the "25 parallel orders" test FAILS (oversell); restore the line.

- [ ] **Step 5: Live application check against Docker Postgres** (scratch server on 3217; never touch port 3100/3000):

```bash
export NEXTAUTH_SECRET=testsecret NEXTAUTH_URL=http://localhost:3217 GOOGLE_CLIENT_ID=id GOOGLE_CLIENT_SECRET=sec NEXT_PUBLIC_SITE_URL=http://localhost:3217 ADMIN_EMAILS=boss@example.com
export DATABASE_URL=postgres://rr:rr_dev_password@localhost:5433/rajasthan
npx next build 2>&1 | grep -E "rror|warning|^[┌├└] [○●ƒ] /($| )"       # Expected: no errors; builds from the DB
(npx next start -p 3217 >/tmp/nx.log 2>&1 &); sleep 4
BASE_URL=http://localhost:3217 node scripts/seo-check.mjs | grep -E "^FAIL|checks passed|failed"   # Expected: All SEO checks passed
ADMIN=$(node -e "import('next-auth/jwt').then(async j=>console.log(await j.encode({token:{email:'boss@example.com'},secret:'testsecret'})))")
CUST=$(node -e "import('next-auth/jwt').then(async j=>console.log(await j.encode({token:{email:'cust@example.com'},secret:'testsecret'})))")
B=localhost:3217; H='content-type: application/json'; CA="Cookie: next-auth.session-token=$ADMIN"; CC="Cookie: next-auth.session-token=$CUST"
BODY='{"name":"Pg Test Bangle","category":"Accessories","city":"Jodhpur","pricePaise":12000,"seller":"Marwar Lac","description":"Hidden until published.","stock":3,"status":"DRAFT","instagram":"marwarlac"}'
R=$(curl -s -X POST $B/api/products -H "$H" -H "$CA" -d "$BODY"); echo "$R" | cut -c1-90; ID=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "draft: public API $(curl -s $B/api/products | grep -c 'Pg Test') /shop $(curl -s $B/shop | grep -c 'Pg Test') page $(curl -s -o /dev/null -w '%{http_code}' $B/products/pg-test-bangle-$ID)"   # Expected: 0 0 404
curl -s -o /dev/null -w 'publish %{http_code}\n' -X PATCH $B/api/products/$ID -H "$H" -H "$CA" -d '{"status":"APPROVED","instagram":""}'
echo "published: page $(curl -s -o /dev/null -w '%{http_code}' $B/products/pg-test-bangle-$ID)  instagram key in API: $(curl -s $B/api/products | grep -c 'marwarlac')"   # Expected: 200, 0 (cleared)
O=$(curl -s -X POST $B/api/orders -H "$H" -H "$CC" -d "{\"items\":[{\"productId\":\"$ID\",\"quantity\":2}]}"); echo "order: $(echo "$O" | cut -c1-70)"
echo "stock after order: $(curl -s $B/api/products | python3 -c "import sys,json;print([p['stock'] for p in json.load(sys.stdin) if p['id']=='$ID'])")"      # Expected: [1]
curl -s -o /dev/null -w 'order too big: %{http_code}\n' -X POST $B/api/orders -H "$H" -H "$CC" -d "{\"items\":[{\"productId\":\"$ID\",\"quantity\":5}]}"   # Expected: 400
curl -s -o /dev/null -w 'delete product: %{http_code}\n' -X DELETE $B/api/products/$ID -H "$CA"
echo "history kept: $(curl -s $B/api/orders -H "$CC" | grep -c 'Pg Test Bangle')"      # Expected: >= 1
docker compose restart db >/dev/null && until docker compose exec -T db pg_isready -U rr -d rajasthan >/dev/null 2>&1; do sleep 1; done
echo "after container restart, order still there: $(curl -s $B/api/orders -H "$CC" | grep -c 'Pg Test Bangle')"   # Expected: >= 1 (data persisted in the volume)
```
- [ ] **Step 6: Failure behaviour (Review Focus 4)** — with the server from Step 5 still running:

```bash
docker compose stop db >/dev/null
echo "DB down → API: $(curl -s -m 20 -o /dev/null -w '%{http_code} in %{time_total}s' $B/api/products)"    # Expected: 500 within ~10s (JSON {"error":"Request failed."}), not a hang
echo "DB down → body: $(curl -s -m 20 $B/api/products | cut -c1-60)"
docker compose start db >/dev/null && until docker compose exec -T db pg_isready -U rr -d rajasthan >/dev/null 2>&1; do sleep 1; done
echo "DB back → API: $(curl -s -m 20 -o /dev/null -w '%{http_code}' $B/api/products)"                      # Expected: 200 again, without restarting Next
pkill -f "next start -p 3217"
env -u DATABASE_URL npx tsx -e "import('./src/db/client').then(m=>{try{m.getDb()}catch(e){console.log('no DATABASE_URL →',e.message)}})"   # Expected: message tells how to fix it
npm run db:reset 2>&1 | tail -2      # Expected: Truncated all tables. / Seeded … { products: 4, workshops: 3, … }  (puts the dev DB back to the seed data)
```
Record any deviation from the expected values in the ledger; a hang (>20 s) or a crashed Next process is a bug to fix (adjust `connect_timeout`/error handling), not to explain away.

- [ ] **Step 7: Docs** — in `README.md`:
  - Replace the "Run it" block with: Node 20.9+ (22 recommended), Docker Desktop, and
    ```bash
    npm install
    cp .env.example .env.local        # fill in the auth values; DATABASE_URL is pre-filled for the Docker DB
    npm run db:up                     # Postgres 16 in Docker on localhost:5433 (your local Postgres on 5432 is untouched)
    npm run db:migrate && npm run db:seed
    npm run dev
    ```
  - Add "Database" section: tables (products, workshops, orders, order_items, bookings, id_counters), `npm run db:seed` (idempotent import of `data/db.json`), `npm run db:reset` (wipe + reseed), `npm run db:down` (stop; data stays in the `rr_pgdata` volume; `docker compose down -v` deletes it), `npm run db:generate` after editing `src/db/schema.ts`, `npm test` uses PGlite (no Docker), `npm run test:pg` runs concurrency tests against Docker Postgres, `next build` needs the DB up and migrated.
  - Replace the "Reset sample data" and "Deploy note" text: data lives in Postgres; `data/db.json` is only the seed source; serverless hosts work as long as `DATABASE_URL` points at a reachable Postgres. Update the limitations paragraph (remove "JSON file … corrupted by concurrent writes").
  - Note the dev credentials are for local development only.

- [ ] **Step 8: Final checks and commit**
```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
npx vitest run 2>&1 | grep -E "Tests |Test Files|×"       # all green, pg suite skipped
git status --short                                        # data/db.json must be unmodified (the app no longer writes it)
git add -A && git commit -m "feat: Docker Postgres verification suite, seed CLI and docs"
```

---

## Self-Review

**Spec coverage:** Docker Postgres (Task 1) · Drizzle (Tasks 2–3) · PGlite for tests (Task 2 harness, Task 3 test migration) · seed script with idempotency and counters (Task 2 lib + Task 4 CLI) · all API contracts and module exports kept (Task 3) · docs/README (Task 4) · port clash with the existing local Postgres handled (5433, Task 1) · Docker daemon prerequisite stated (Environment facts, Task 1 Step 6, Task 4 Step 4).

**Placeholder scan:** no TBD/TODO; all steps contain code or exact commands. `admin.ts` is edited by "keep helpers, replace the marked segments" with the replacement code shown in full, because the untouched validators are long and unchanged.

**Type consistency:** `Database`/`Tx`/`Q` (Task 2 `client.ts`) are used by `allocateId(q: Q, …)` and the seed/test helpers; mapper names `toProduct/toProductRow/toWorkshop/toWorkshopRow/toOrder/toBooking` are identical in Tasks 2–3; `allocateId(tx, 'p'|'w')` is called with a transaction in `admin.ts`; `LegacyDb` is shared by `seed.ts`, `testdb.ts`, `scripts/db-seed.ts` and `pg-concurrency.test.ts`; harness exports `resetTestDb`, `getTestDb`, `snapshot` match the migration script in Task 3 Step 1.

**Review Focus coverage:** (1) Task 4 Steps 1+4 (real Postgres, including the opposite-order deadlock test and the mutation check); (2) Task 3 Step 2 search tests; (3) Task 2 mapper test + Task 3 Step 2 admin clearing test; (4) Task 4 Step 6; (5) Task 2 seed/counter tests + Task 3 orders history test.

**Known limits / decisions to confirm:** (a) PGlite is a 0.x package (tests only); (b) `next build` needs the database running; (c) artist grouping in SQL uses `\s`-based whitespace collapsing and `lower()`, which matches `artistKey()` for normal text but not for exotic Unicode whitespace/normalisation (same deferred minor as before); (d) no connection-pool tuning beyond `max: 10`; (e) the Docker password is a local-development default; production needs a managed secret and `DATABASE_URL`; (f) `data/db.json` remains tracked as seed data and is no longer written at runtime.
