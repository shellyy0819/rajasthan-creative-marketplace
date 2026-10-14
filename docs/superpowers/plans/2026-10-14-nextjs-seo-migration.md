# Next.js + SEO Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the vanilla-Node "Rang Rajasthan" marketplace prototype into a Next.js (App Router, TypeScript) app whose pages are server-rendered, crawlable, and follow 2026 SEO best practices.

**Architecture:** Next.js App Router. Server Components render all indexable content (home, `/shop`, `/workshops`, `/products/[slug]`, `/workshops/[slug]`, `/cities/[city]`) straight from a repository layer over `data/db.json`. The existing `/api/*` endpoints become Route Handlers with identical contracts. Interactive bits (cart, checkout, booking dialogs, toast) are small Client Components behind one provider. SEO is generated from data: Metadata API, canonical URLs, JSON-LD (Organization, WebSite, Product+Offer, Event, BreadcrumbList), `sitemap.ts`, `robots.ts`, `manifest.ts`, dynamic OG images.

**Tech Stack:** Next.js latest stable (App Router; `params`/`searchParams` are Promises — Next 15+), React latest, TypeScript, Vitest, `next/font`, `next/og`. No DB change (JSON file stays, as in README; Postgres/Prisma remains the documented later step).

**Spec:** No spec doc exists. Requirements = user request "convert this to nextjs and support SEO with best practices in 2026" + behavior baseline in `README.md`, `server.js`, `public/index.html`, `public/app.js`, `public/styles.css`, `data/db.json`.

## Global Constraints

- Preserve all existing API routes, query params, request/response JSON shapes and status codes (`GET /api/health|products|workshops|admin/summary`, `POST /api/orders|bookings`). Error bodies stay `{ "error": string }`.
- Preserve existing UI look: reuse `styles.css` rules unchanged except font-family/`@import` swap to `next/font`.
- Demo-only semantics stay: no payment collected; wording "Demo only: no payment has been collected." unchanged.
- All money in paise integers, shown via `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0})`.
- Indexable content must be in server-rendered HTML (view-source shows products/workshops). No content that only appears after client fetch.
- One `<h1>` per page; every page has unique `<title>`, meta description ≤160 chars, self-referencing canonical.
- Site origin comes from `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`), trailing slash stripped.
- Locale `en-IN`, `<html lang="en-IN">`.
- Node >= 18.18 (Next requirement; verify against installed Next `engines`).

## Review Focus

1. Unknown product/workshop/city slug, or right id with wrong name part (`/products/anything-p1`) → real HTTP 404 (not 200 soft-404, not duplicate-content page).
2. Filter URLs (`/shop?city=Jaipur&q=x`, repeated params `?city=a&city=b`, junk city, 10k-char `q`) → no crash, canonical stays `/shop`, filtered views `noindex,follow`.
3. Concurrent orders/bookings (double-click, two tabs) must not corrupt `data/db.json` or oversell stock.
4. Text with `</script>` or `<` in product/workshop fields must not break out of JSON-LD `<script>`.
5. Sold-out product / full workshop → JSON-LD availability `OutOfStock`/`SoldOut`, buy/reserve buttons disabled, page still indexable.

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, .gitignore, .env.example
legacy/                       # old server.js + public/* moved here, deleted in Task 11
data/db.json                  # unchanged
tests/fixtures/db.json        # copy of seed for tests
scripts/seo-check.mjs         # post-build HTTP assertions
src/lib/types.ts              # Product, Workshop, Order, Booking, Db
src/lib/money.ts              # money(paise)
src/lib/slug.ts               # slugify
src/lib/format.ts             # formatDay, truncate
src/lib/site.ts               # SITE, siteUrl(), abs()
src/lib/db.ts                 # readDb, mutateDb (serialized, atomic write)
src/lib/errors.ts             # ApiError
src/lib/catalog.ts            # CITIES, CATEGORIES, slugs, list/get queries
src/lib/filters.ts            # parseFilters(searchParams)
src/lib/orders.ts             # createOrder, createBooking
src/lib/jsonld.ts             # serializeJsonLd + schema builders
src/lib/meta.ts               # pageMetadata()
src/lib/og.tsx                # renderOg()
src/app/layout.tsx            # fonts, metadata, header/footer, provider, global JSON-LD
src/app/globals.css           # ported styles.css + additions
src/app/page.tsx              # home
src/app/shop/page.tsx
src/app/workshops/page.tsx
src/app/products/[slug]/page.tsx (+ opengraph-image.tsx)
src/app/workshops/[slug]/page.tsx (+ opengraph-image.tsx)
src/app/cities/[city]/page.tsx
src/app/not-found.tsx, error.tsx
src/app/sitemap.ts, robots.ts, manifest.ts, opengraph-image.tsx
src/app/api/{health,products,workshops,orders,bookings,admin/summary}/route.ts
src/components/{Header,Footer,Hero,ProductCard,ProductGrid,WorkshopCard,WorkshopList,FilterForm,JsonLd,Breadcrumbs}.tsx
src/components/{StoreProvider,CartButton,CartDialog,BookingDialog,AddToCartButton,ReserveButton}.tsx   # client
tests/*.test.ts
```

---

### Task 1: Scaffold Next.js, tooling, move legacy

**Files:**
- Create: `package.json` (overwrite), `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `tests/fixtures/db.json`, `src/app/layout.tsx` (placeholder), `src/app/page.tsx` (placeholder)
- Move: `server.js`, `public/*` → `legacy/`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `test`; path alias `@/*` → `src/*`; env `DB_PATH` override (used by tests).

- [ ] **Step 1: Init git and move legacy files out of the way** (`public/` would otherwise serve the old `index.html` as duplicate content)

```bash
cd /Users/shellyagarwal/Downloads/rajasthan-creative-marketplace
git init
mkdir -p legacy tests/fixtures src/app
git mv server.js legacy/ 2>/dev/null || mv server.js legacy/
mv public/index.html public/styles.css public/app.js legacy/ && rmdir public 2>/dev/null; mkdir -p public
cp data/db.json tests/fixtures/db.json
cat > .gitignore <<'EOF'
node_modules
.next
.env*.local
*.tsbuildinfo
next-env.d.ts
data/db.json.tmp
EOF
echo 'NEXT_PUBLIC_SITE_URL=http://localhost:3000' > .env.example
```

- [ ] **Step 2: Install deps**

```bash
cat > package.json <<'EOF'
{
  "name": "rajasthan-creative-marketplace",
  "version": "0.2.0",
  "private": true,
  "description": "Next.js marketplace for Rajasthan handmade products and creative workshops",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "seo:check": "node scripts/seo-check.mjs"
  }
}
EOF
npm install next@latest react@latest react-dom@latest
npm install -D typescript @types/node @types/react @types/react-dom vitest
```
Expected: installs without error. Note installed `next` version (`npx next --version`) in the PR description.

- [ ] **Step 3: Config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "legacy"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

Placeholder `src/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en-IN"><body>{children}</body></html>);
}
```
Placeholder `src/app/page.tsx`: `export default function Page() { return <h1>Rang Rajasthan</h1>; }`

- [ ] **Step 4: Verify build**

Run: `npx next build`
Expected: build succeeds, route `/` listed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app, move legacy server to legacy/"
```

---

### Task 2: Core lib (types, money, slug, format, site, errors)

**Files:**
- Create: `src/lib/types.ts`, `money.ts`, `slug.ts`, `format.ts`, `site.ts`, `errors.ts`
- Test: `tests/lib-basics.test.ts`

**Interfaces:**
- Produces:
  - `type Product = { id:string; name:string; category:string; city:string; pricePaise:number; seller:string; description:string; stock:number; status:string }`
  - `type Workshop = { id:string; title:string; type:'FREE'|'PAID'; pricePaise:number; city:string; venue:string; date:string; time:string; seats:number; booked:number; host:string; description:string; status:string }`
  - `type Order`, `type Booking`, `type Db = { products:Product[]; workshops:Workshop[]; orders:Order[]; bookings:Booking[] }`
  - `money(paise:number): string`, `slugify(s:string): string`, `formatDay(date:string): {day:number; month:string}`, `truncate(s:string, max:number): string`
  - `SITE`, `siteUrl(): string`, `abs(path:string): string`
  - `class ApiError extends Error { status:number; constructor(status:number, message:string) }`

- [ ] **Step 1: Write failing test** `tests/lib-basics.test.ts`

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { money } from '@/lib/money';
import { slugify } from '@/lib/slug';
import { formatDay, truncate } from '@/lib/format';
import { siteUrl, abs } from '@/lib/site';

describe('money', () => {
  it('formats paise as INR with no decimals', () => {
    expect(money(85000)).toBe('₹850');
    expect(money(0)).toBe('₹0');
  });
});

describe('slugify', () => {
  it('lowercases, replaces & and punctuation, trims dashes', () => {
    expect(slugify('Pressed Flower Resin Coaster Set')).toBe('pressed-flower-resin-coaster-set');
    expect(slugify('Crochet & Textiles!')).toBe('crochet-and-textiles');
    expect(slugify('  --Hi--  ')).toBe('hi');
  });
});

describe('format', () => {
  it('formatDay uses IST regardless of server tz', () => {
    expect(formatDay('2026-11-08')).toEqual({ day: 8, month: 'Nov' });
  });
  it('truncate adds ellipsis only when needed', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
});

describe('site', () => {
  const orig = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = orig; });
  it('strips trailing slashes and builds absolute urls', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com//';
    expect(siteUrl()).toBe('https://example.com');
    expect(abs('/shop')).toBe('https://example.com/shop');
    expect(abs('shop')).toBe('https://example.com/shop');
  });
  it('defaults to localhost', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/lib-basics.test.ts` — Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/types.ts`:
```ts
export type Product = {
  id: string; name: string; category: string; city: string; pricePaise: number;
  seller: string; description: string; stock: number; status: string;
};
export type Workshop = {
  id: string; title: string; type: 'FREE' | 'PAID'; pricePaise: number; city: string;
  venue: string; date: string; time: string; seats: number; booked: number;
  host: string; description: string; status: string;
};
export type OrderItem = {
  productId: string; name: string; seller: string; quantity: number;
  unitPricePaise: number; lineTotalPaise: number;
};
export type Order = {
  id: string; createdAt: string; customerName: string; email: string;
  items: OrderItem[]; totalPaise: number; status: string; note: string;
};
export type Booking = {
  id: string; createdAt: string; workshopId: string; title: string; attendeeName: string;
  email: string; quantity: number; totalPaise: number; status: string; note: string;
};
export type Db = { products: Product[]; workshops: Workshop[]; orders: Order[]; bookings: Booking[] };
```

`src/lib/money.ts`:
```ts
const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = (paise: number) => fmt.format(paise / 100);
```

`src/lib/slug.ts`:
```ts
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

`src/lib/format.ts`:
```ts
const TZ = 'Asia/Kolkata';
export function formatDay(date: string): { day: number; month: string } {
  const d = new Date(`${date}T12:00:00+05:30`);
  return {
    day: Number(d.toLocaleString('en-IN', { day: 'numeric', timeZone: TZ })),
    month: d.toLocaleString('en-IN', { month: 'short', timeZone: TZ }),
  };
}
export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}
```

`src/lib/site.ts`:
```ts
export const SITE = {
  name: 'Rang Rajasthan',
  tagline: 'Handmade finds & creative workshops in Rajasthan',
  description:
    'Discover independent Rajasthan makers, thoughtful handmade finds, and creative workshops in Udaipur, Jaipur and Jodhpur.',
  locale: 'en_IN',
  email: 'hello@rangrajasthan.example',
};
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
export const abs = (p: string) => siteUrl() + (p.startsWith('/') ? p : `/${p}`);
```

`src/lib/errors.ts`:
```ts
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
```

- [ ] **Step 4: Run** `npx vitest run tests/lib-basics.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: core lib helpers"`

---

### Task 3: Serialized atomic DB layer

**Files:**
- Create: `src/lib/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: `Db` from `types.ts`.
- Produces: `readDb(): Promise<Db>`, `mutateDb<T>(fn:(db:Db)=>T|Promise<T>): Promise<T>` — runs `fn` on a fresh read, one at a time; writes only if `fn` resolves; atomic write via temp file + rename. DB path = `process.env.DB_PATH ?? <cwd>/data/db.json`.

- [ ] **Step 1: Failing test** `tests/db.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readDb, mutateDb } from '@/lib/db';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrdb-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});

describe('db', () => {
  it('reads seed data', async () => {
    const db = await readDb();
    expect(db.products.length).toBe(4);
  });

  it('serializes 25 concurrent mutations without losing writes', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        mutateDb(db => { db.orders.push({ id: String(i) } as never); }),
      ),
    );
    const db = await readDb();
    expect(db.orders).toHaveLength(25);
  });

  it('does not write when the mutation throws', async () => {
    await expect(mutateDb(db => { db.products[0].stock = 0; throw new Error('nope'); })).rejects.toThrow('nope');
    expect((await readDb()).products[0].stock).toBe(8);
  });

  it('keeps working after a failed mutation', async () => {
    await mutateDb(() => { throw new Error('x'); }).catch(() => {});
    await mutateDb(db => { db.bookings.push({ id: 'b' } as never); });
    expect((await readDb()).bookings).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/db.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/db.ts`

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Db } from './types';

const dbPath = () => process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'db.json');

export async function readDb(): Promise<Db> {
  return JSON.parse(await fs.readFile(dbPath(), 'utf8')) as Db;
}

let queue: Promise<unknown> = Promise.resolve();

export function mutateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    const tmp = `${dbPath()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, dbPath());
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
```

- [ ] **Step 4: Run** `npx vitest run tests/db.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: serialized atomic JSON db layer"`

---

### Task 4: Catalog queries, slugs, filter parsing

**Files:**
- Create: `src/lib/catalog.ts`, `src/lib/filters.ts`
- Test: `tests/catalog.test.ts`, `tests/filters.test.ts`

**Interfaces:**
- Consumes: `readDb`, `slugify`, types.
- Produces:
  - `CITIES: readonly ['Udaipur','Jaipur','Jodhpur']`, `CATEGORIES: readonly ['Crochet & Textiles','Accessories','Resin Art','Pottery']`
  - `citySlug(city:string): string` (lowercase), `cityFromSlug(slug:string): string | undefined`
  - `productSlug(p:Product): string` = `${slugify(p.name)}-${p.id}`; `workshopSlug(w:Workshop): string` = `${slugify(w.title)}-${w.id}`
  - `type ProductFilter = { city?:string; category?:string; q?:string }`, `type WorkshopFilter = { city?:string; type?:string; q?:string }`
  - `listProducts(f?:ProductFilter): Promise<Product[]>`, `listWorkshops(f?:WorkshopFilter): Promise<Workshop[]>` (APPROVED only; `'All Rajasthan'`/`'All categories'`/`'ALL'`/empty = no filter; q case-insensitive over same fields as legacy server)
  - `getProductBySlug(slug:string): Promise<Product|undefined>`, `getWorkshopBySlug(slug:string): Promise<Workshop|undefined>` (exact slug match required)
  - `parseFilters(sp: Record<string,string|string[]|undefined>): { city?:string; category?:string; q?:string; type?:'FREE'|'PAID' }` and `hasFilters(f): boolean`

- [ ] **Step 1: Failing tests**

`tests/catalog.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listProducts, listWorkshops, getProductBySlug, getWorkshopBySlug,
  productSlug, workshopSlug, cityFromSlug, citySlug,
} from '@/lib/catalog';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrcat-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});

describe('catalog', () => {
  it('lists all approved products with no filter', async () => {
    expect(await listProducts()).toHaveLength(4);
  });
  it('treats "All Rajasthan"/"All categories" as no filter', async () => {
    expect(await listProducts({ city: 'All Rajasthan', category: 'All categories' })).toHaveLength(4);
  });
  it('filters by city, category and q', async () => {
    expect((await listProducts({ city: 'Jaipur' })).map(p => p.id)).toEqual(['p3', 'p4']);
    expect((await listProducts({ category: 'Pottery' })).map(p => p.id)).toEqual(['p4']);
    expect((await listProducts({ q: 'FLOWER' })).map(p => p.id).sort()).toEqual(['p1', 'p3']);
  });
  it('filters workshops by type', async () => {
    expect((await listWorkshops({ type: 'FREE' })).map(w => w.id)).toEqual(['w3']);
    expect(await listWorkshops({ type: 'ALL' })).toHaveLength(3);
  });
  it('slugs are name + id and resolve exactly', async () => {
    const [p] = await listProducts();
    expect(productSlug(p)).toBe('crochet-lily-bouquet-p1');
    expect((await getProductBySlug('crochet-lily-bouquet-p1'))?.id).toBe('p1');
    const [w] = await listWorkshops();
    expect(workshopSlug(w)).toBe('beginner-crochet-make-your-first-flower-w1');
    expect((await getWorkshopBySlug(workshopSlug(w)))?.id).toBe('w1');
  });
  it('rejects right id with wrong name part, and unknown slugs', async () => {
    expect(await getProductBySlug('anything-p1')).toBeUndefined();
    expect(await getProductBySlug('nope')).toBeUndefined();
    expect(await getWorkshopBySlug('x-w1')).toBeUndefined();
  });
  it('city slug round trip', () => {
    expect(citySlug('Udaipur')).toBe('udaipur');
    expect(cityFromSlug('jodhpur')).toBe('Jodhpur');
    expect(cityFromSlug('delhi')).toBeUndefined();
  });
});
```

`tests/filters.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseFilters, hasFilters } from '@/lib/filters';

describe('parseFilters', () => {
  it('returns empty for no params', () => {
    expect(parseFilters({})).toEqual({});
    expect(hasFilters(parseFilters({}))).toBe(false);
  });
  it('accepts known city/category/type', () => {
    expect(parseFilters({ city: 'Jaipur', category: 'Pottery', type: 'FREE' }))
      .toEqual({ city: 'Jaipur', category: 'Pottery', type: 'FREE' });
  });
  it('drops unknown city/category/type', () => {
    expect(parseFilters({ city: 'Mars', category: 'x', type: 'weird' })).toEqual({});
  });
  it('uses first value of repeated params', () => {
    expect(parseFilters({ city: ['Jaipur', 'Udaipur'] })).toEqual({ city: 'Jaipur' });
  });
  it('treats "All Rajasthan" as no filter', () => {
    expect(parseFilters({ city: 'All Rajasthan' })).toEqual({});
  });
  it('trims q and caps length at 100', () => {
    expect(parseFilters({ q: '  hi  ' })).toEqual({ q: 'hi' });
    expect(parseFilters({ q: 'a'.repeat(10000) }).q).toHaveLength(100);
    expect(parseFilters({ q: '   ' })).toEqual({});
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/catalog.test.ts tests/filters.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/catalog.ts`:
```ts
import { readDb } from './db';
import { slugify } from './slug';
import type { Product, Workshop } from './types';

export const CITIES = ['Udaipur', 'Jaipur', 'Jodhpur'] as const;
export const CATEGORIES = ['Crochet & Textiles', 'Accessories', 'Resin Art', 'Pottery'] as const;

export const citySlug = (city: string) => slugify(city);
export const cityFromSlug = (slug: string) => CITIES.find(c => citySlug(c) === slug);

export const productSlug = (p: Product) => `${slugify(p.name)}-${p.id}`;
export const workshopSlug = (w: Workshop) => `${slugify(w.title)}-${w.id}`;

export type ProductFilter = { city?: string; category?: string; q?: string };
export type WorkshopFilter = { city?: string; type?: string; q?: string };

const anyCity = (c?: string) => !c || c === 'All Rajasthan';

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  const q = (f.q ?? '').toLowerCase();
  const { products } = await readDb();
  return products.filter(
    p =>
      p.status === 'APPROVED' &&
      (anyCity(f.city) || p.city === f.city) &&
      (!f.category || f.category === 'All categories' || p.category === f.category) &&
      (!q || `${p.name} ${p.description} ${p.seller} ${p.category}`.toLowerCase().includes(q)),
  );
}

export async function listWorkshops(f: WorkshopFilter = {}): Promise<Workshop[]> {
  const q = (f.q ?? '').toLowerCase();
  const { workshops } = await readDb();
  return workshops.filter(
    w =>
      w.status === 'APPROVED' &&
      (anyCity(f.city) || w.city === f.city) &&
      (!f.type || f.type === 'ALL' || w.type === f.type) &&
      (!q || `${w.title} ${w.description} ${w.venue} ${w.host}`.toLowerCase().includes(q)),
  );
}

export async function getProductBySlug(slug: string) {
  return (await listProducts()).find(p => productSlug(p) === slug);
}
export async function getWorkshopBySlug(slug: string) {
  return (await listWorkshops()).find(w => workshopSlug(w) === slug);
}
```

`src/lib/filters.ts`:
```ts
import { CITIES, CATEGORIES } from './catalog';

type SP = Record<string, string | string[] | undefined>;
export type Filters = { city?: string; category?: string; q?: string; type?: 'FREE' | 'PAID' };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilters(sp: SP): Filters {
  const out: Filters = {};
  const city = first(sp.city);
  if (city && (CITIES as readonly string[]).includes(city)) out.city = city;
  const category = first(sp.category);
  if (category && (CATEGORIES as readonly string[]).includes(category)) out.category = category;
  const type = first(sp.type);
  if (type === 'FREE' || type === 'PAID') out.type = type;
  const q = (first(sp.q) ?? '').trim().slice(0, 100);
  if (q) out.q = q;
  return out;
}

export const hasFilters = (f: Filters) => Object.keys(f).length > 0;
```

- [ ] **Step 4: Run** same command — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: catalog queries, slugs, filter parsing"`

---

### Task 5: Orders/bookings logic + API route handlers

**Files:**
- Create: `src/lib/orders.ts`, `src/app/api/health/route.ts`, `api/products/route.ts`, `api/workshops/route.ts`, `api/orders/route.ts`, `api/bookings/route.ts`, `api/admin/summary/route.ts`, `src/lib/api.ts`
- Test: `tests/orders.test.ts`, `tests/api.test.ts`

**Interfaces:**
- Consumes: `mutateDb`, `readDb`, `listProducts`, `listWorkshops`, `ApiError`.
- Produces:
  - `createOrder(input: unknown): Promise<Order>` — throws `ApiError(400, 'Add at least one item.')` for empty/non-array items; `ApiError(400,'A product is unavailable or quantity exceeds stock.')` for bad product/qty; decrements stock atomically; status `'DEMO_ORDER_CREATED'`, note `'Demo only: no payment has been collected.'`
  - `createBooking(input: unknown): Promise<Booking>` — `ApiError(404,'Workshop not found.')`, `ApiError(409,'Not enough seats remaining.')`; status `'CONFIRMED_FREE_DEMO'` for FREE else `'DEMO_BOOKING_CREATED'`; notes as in legacy `server.js`.
  - `handle(fn:()=>Promise<Response>): Promise<Response>` and `json(data:unknown, status=200): Response` in `src/lib/api.ts`. `handle` maps `ApiError`→its status, invalid JSON body→400 `{error:'Invalid JSON'}`, anything else→500 `{error:'Request failed.'}`.
  - Mutating handlers call `revalidatePath('/', 'layout')` from `next/cache` after success.

- [ ] **Step 1: Failing tests**

`tests/orders.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOrder, createBooking } from '@/lib/orders';
import { readDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrord-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});

describe('createOrder', () => {
  it('creates order, totals, decrements stock', async () => {
    const o = await createOrder({ customerName: 'A', email: 'a@b.co', items: [{ productId: 'p1', quantity: 2 }] });
    expect(o.totalPaise).toBe(170000);
    expect(o.status).toBe('DEMO_ORDER_CREATED');
    expect((await readDb()).products.find(p => p.id === 'p1')!.stock).toBe(6);
  });
  it('rejects empty items with 400', async () => {
    await expect(createOrder({ items: [] })).rejects.toMatchObject({ status: 400, message: 'Add at least one item.' });
    await expect(createOrder(null)).rejects.toBeInstanceOf(ApiError);
  });
  it('rejects over-stock, bad qty, unknown product — and writes nothing', async () => {
    for (const items of [
      [{ productId: 'p1', quantity: 99 }],
      [{ productId: 'p1', quantity: 0 }],
      [{ productId: 'p1', quantity: 1.5 }],
      [{ productId: 'zzz', quantity: 1 }],
    ]) {
      await expect(createOrder({ items })).rejects.toMatchObject({ status: 400 });
    }
    const db = await readDb();
    expect(db.orders).toHaveLength(0);
    expect(db.products[0].stock).toBe(8);
  });
  it('does not oversell under concurrency', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => createOrder({ items: [{ productId: 'p3', quantity: 1 }] })),
    );
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(5); // p3 stock = 5
    expect((await readDb()).products.find(p => p.id === 'p3')!.stock).toBe(0);
  });
});

describe('createBooking', () => {
  it('books free workshop as confirmed', async () => {
    const b = await createBooking({ workshopId: 'w3', attendeeName: 'X', email: 'x@y.co', quantity: 2 });
    expect(b.status).toBe('CONFIRMED_FREE_DEMO');
    expect(b.totalPaise).toBe(0);
    expect((await readDb()).workshops.find(w => w.id === 'w3')!.booked).toBe(8);
  });
  it('404 for unknown workshop, 409 for too many seats', async () => {
    await expect(createBooking({ workshopId: 'nope' })).rejects.toMatchObject({ status: 404 });
    await expect(createBooking({ workshopId: 'w1', quantity: 10 })).rejects.toMatchObject({ status: 409 });
  });
  it('does not overbook under concurrency', async () => {
    const r = await Promise.allSettled(
      Array.from({ length: 12 }, () => createBooking({ workshopId: 'w1', quantity: 1 })),
    );
    expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(9); // 12 seats - 3 booked
  });
});
```

`tests/api.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { GET as health } from '@/app/api/health/route';
import { GET as products } from '@/app/api/products/route';
import { GET as workshops } from '@/app/api/workshops/route';
import { POST as orders } from '@/app/api/orders/route';
import { POST as bookings } from '@/app/api/bookings/route';
import { GET as summary } from '@/app/api/admin/summary/route';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrapi-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});

const post = (url: string, body: string) =>
  new Request(`http://x${url}`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });

describe('api', () => {
  it('health', async () => {
    const r = await health();
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });
  it('products filters by query string', async () => {
    const r = await products(new Request('http://x/api/products?city=Jaipur&q=blue'));
    expect((await r.json()).map((p: { id: string }) => p.id)).toEqual(['p4']);
  });
  it('workshops filters by type', async () => {
    const r = await workshops(new Request('http://x/api/workshops?type=FREE'));
    expect((await r.json())).toHaveLength(1);
  });
  it('POST /api/orders 201 then 400 on bad body', async () => {
    const ok = await orders(post('/api/orders', JSON.stringify({ items: [{ productId: 'p2', quantity: 1 }] })));
    expect(ok.status).toBe(201);
    const bad = await orders(post('/api/orders', JSON.stringify({ items: [] })));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Add at least one item.' });
  });
  it('invalid JSON → 400', async () => {
    const r = await orders(post('/api/orders', '{nope'));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'Invalid JSON' });
  });
  it('POST /api/bookings 201 / 404 / 409', async () => {
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'w3' })))).status).toBe(201);
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'x' })))).status).toBe(404);
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'w1', quantity: 50 })))).status).toBe(409);
  });
  it('summary counts', async () => {
    const j = await (await summary()).json();
    expect(j).toMatchObject({ products: 4, workshops: 3, orders: 0, bookings: 0 });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/orders.test.ts tests/api.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/orders.ts`:
```ts
import crypto from 'node:crypto';
import { mutateDb } from './db';
import { ApiError } from './errors';
import type { Booking, Order } from './types';

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback: string, max: number) => String(v ?? fallback).slice(0, max) || fallback;

export async function createOrder(input: unknown): Promise<Order> {
  const b = (input ?? {}) as Raw;
  if (!Array.isArray(b.items) || !b.items.length) throw new ApiError(400, 'Add at least one item.');
  const reqItems = b.items as Raw[];
  return mutateDb(db => {
    const items = reqItems.map(i => {
      const p = db.products.find(p => p.id === i.productId && p.status === 'APPROVED');
      const qty = Number(i.quantity);
      if (!p || !Number.isInteger(qty) || qty < 1 || qty > p.stock)
        throw new ApiError(400, 'A product is unavailable or quantity exceeds stock.');
      return { productId: p.id, name: p.name, seller: p.seller, quantity: qty, unitPricePaise: p.pricePaise, lineTotalPaise: p.pricePaise * qty };
    });
    // same product listed twice: re-check combined quantity
    const totals = new Map<string, number>();
    for (const it of items) totals.set(it.productId, (totals.get(it.productId) ?? 0) + it.quantity);
    for (const [id, qty] of totals)
      if (qty > db.products.find(p => p.id === id)!.stock)
        throw new ApiError(400, 'A product is unavailable or quantity exceeds stock.');
    const order: Order = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      customerName: str(b.customerName, 'Demo Customer', 100),
      email: String(b.email ?? '').slice(0, 200),
      items,
      totalPaise: items.reduce((s, i) => s + i.lineTotalPaise, 0),
      status: 'DEMO_ORDER_CREATED',
      note: 'Demo only: no payment has been collected.',
    };
    for (const [id, qty] of totals) db.products.find(p => p.id === id)!.stock -= qty;
    db.orders.push(order);
    return order;
  });
}

export async function createBooking(input: unknown): Promise<Booking> {
  const b = (input ?? {}) as Raw;
  const qty = Number(b.quantity ?? 1);
  return mutateDb(db => {
    const w = db.workshops.find(w => w.id === b.workshopId && w.status === 'APPROVED');
    if (!w) throw new ApiError(404, 'Workshop not found.');
    if (!Number.isInteger(qty) || qty < 1 || qty > w.seats - w.booked)
      throw new ApiError(409, 'Not enough seats remaining.');
    const free = w.type === 'FREE';
    const booking: Booking = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      workshopId: w.id,
      title: w.title,
      attendeeName: str(b.attendeeName, 'Demo Guest', 100),
      email: String(b.email ?? '').slice(0, 200),
      quantity: qty,
      totalPaise: w.pricePaise * qty,
      status: free ? 'CONFIRMED_FREE_DEMO' : 'DEMO_BOOKING_CREATED',
      note: free ? 'Free demo booking confirmed; no payment required.' : 'Demo only: no payment has been collected.',
    };
    w.booked += qty;
    db.bookings.push(booking);
    return booking;
  });
}
```

`src/lib/api.ts`:
```ts
import { ApiError } from './errors';

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 1_000_000) throw new ApiError(413, 'Payload too large');
  try { return text ? JSON.parse(text) : {}; } catch { throw new ApiError(400, 'Invalid JSON'); }
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try { return await fn(); }
  catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Request failed.' }, 500);
  }
}
```

Route handlers (all `export const dynamic = 'force-dynamic';`):

`api/health/route.ts`:
```ts
import { json } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  return json({ ok: true, service: 'Rajasthan Creative Marketplace', timestamp: new Date().toISOString() });
}
```
`api/products/route.ts`:
```ts
import { handle, json } from '@/lib/api';
import { listProducts } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  return json(await listProducts({ city: sp.get('city') ?? undefined, category: sp.get('category') ?? undefined, q: sp.get('q') ?? undefined }));
});
```
`api/workshops/route.ts`: same with `listWorkshops({ city, type, q })`.
`api/orders/route.ts`:
```ts
import { revalidatePath } from 'next/cache';
import { handle, json, readJson } from '@/lib/api';
import { createOrder } from '@/lib/orders';
export const dynamic = 'force-dynamic';
export const POST = (req: Request) => handle(async () => {
  const order = await createOrder(await readJson(req));
  revalidatePath('/', 'layout');
  return json(order, 201);
});
```
`api/bookings/route.ts`: same with `createBooking`.
`api/admin/summary/route.ts`:
```ts
import { handle, json } from '@/lib/api';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  const db = await readDb();
  return json({ products: db.products.length, workshops: db.workshops.length, orders: db.orders.length, bookings: db.bookings.length, note: 'Local demo summary; admin authentication is not implemented.' });
});
```
(`/api/admin/summary` stays unprotected as in legacy; also served with `X-Robots-Tag: noindex` — add to `next.config.ts` headers: `{ source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }`.)

- [ ] **Step 4: Run** `npx vitest run` — Expected: all PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: orders/bookings logic and API route handlers"`

---

### Task 6: SEO helpers — JSON-LD and page metadata

**Files:**
- Create: `src/lib/jsonld.ts`, `src/lib/meta.ts`, `src/components/JsonLd.tsx`
- Test: `tests/jsonld.test.ts`, `tests/meta.test.ts`

**Interfaces:**
- Consumes: `abs`, `SITE`, `productSlug`, `workshopSlug`, `truncate`, `money`, types.
- Produces:
  - `serializeJsonLd(data:unknown): string` — JSON with every `<` escaped as `<`
  - `organizationJsonLd()`, `websiteJsonLd()`, `productJsonLd(p:Product)`, `workshopJsonLd(w:Workshop)`, `breadcrumbJsonLd(items:{name:string; path:string}[])` — all return plain objects with `@context`
  - `pageMetadata(o:{ title:string; description:string; path:string; noindex?:boolean; image?:string }): Metadata` — canonical = `path` (relative, resolved by `metadataBase`), description truncated to 160, OG + Twitter filled, `robots: {index:false, follow:true}` when `noindex`
  - `<JsonLd data={...} />` server component rendering `<script type="application/ld+json">`.

- [ ] **Step 1: Failing tests**

`tests/jsonld.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { serializeJsonLd, productJsonLd, workshopJsonLd, breadcrumbJsonLd, organizationJsonLd } from '@/lib/jsonld';
import type { Product, Workshop } from '@/lib/types';

beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = 'https://rr.test'; });

const product: Product = { id: 'p1', name: 'Crochet Lily Bouquet', category: 'Crochet & Textiles', city: 'Udaipur', pricePaise: 85000, seller: 'Shauk and Stuff', description: 'Handmade.', stock: 8, status: 'APPROVED' };
const workshop: Workshop = { id: 'w1', title: 'Beginner Crochet', type: 'PAID', pricePaise: 49900, city: 'Udaipur', venue: 'The Courtyard Café', date: '2026-11-08', time: '11:00', seats: 12, booked: 3, host: 'Shauk and Stuff', description: 'Fun.', status: 'APPROVED' };

describe('serializeJsonLd', () => {
  it('escapes < so </script> cannot break out', () => {
    const s = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('<');
    expect(JSON.parse(s).name).toBe('</script><script>alert(1)</script>');
  });
});

describe('productJsonLd', () => {
  it('has offer in INR with decimal price, InStock, absolute url + image', () => {
    const j = productJsonLd(product) as any;
    expect(j['@type']).toBe('Product');
    expect(j.offers).toMatchObject({ '@type': 'Offer', priceCurrency: 'INR', price: '850.00', availability: 'https://schema.org/InStock', url: 'https://rr.test/products/crochet-lily-bouquet-p1' });
    expect(j.image[0]).toBe('https://rr.test/products/crochet-lily-bouquet-p1/opengraph-image');
    expect(j.brand).toMatchObject({ '@type': 'Brand', name: 'Shauk and Stuff' });
  });
  it('OutOfStock when stock is 0', () => {
    expect((productJsonLd({ ...product, stock: 0 }) as any).offers.availability).toBe('https://schema.org/OutOfStock');
  });
});

describe('workshopJsonLd', () => {
  it('builds an Event with IST start date, offline mode, capacity', () => {
    const j = workshopJsonLd(workshop) as any;
    expect(j['@type']).toBe('Event');
    expect(j.startDate).toBe('2026-11-08T11:00:00+05:30');
    expect(j.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect(j.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(j.location).toMatchObject({ '@type': 'Place', name: 'The Courtyard Café', address: { addressLocality: 'Udaipur', addressRegion: 'Rajasthan', addressCountry: 'IN' } });
    expect(j.remainingAttendeeCapacity).toBe(9);
    expect(j.offers).toMatchObject({ price: '499.00', availability: 'https://schema.org/InStock' });
  });
  it('SoldOut when full; free price is 0.00', () => {
    const j = workshopJsonLd({ ...workshop, booked: 12, type: 'FREE', pricePaise: 0 }) as any;
    expect(j.offers.availability).toBe('https://schema.org/SoldOut');
    expect(j.offers.price).toBe('0.00');
  });
});

describe('breadcrumb + org', () => {
  it('breadcrumb positions start at 1 with absolute items', () => {
    const j = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]) as any;
    expect(j.itemListElement[1]).toMatchObject({ position: 2, name: 'Shop', item: 'https://rr.test/shop' });
  });
  it('organization has name and url', () => {
    expect(organizationJsonLd()).toMatchObject({ '@type': 'Organization', name: 'Rang Rajasthan', url: 'https://rr.test' });
  });
});
```

`tests/meta.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pageMetadata } from '@/lib/meta';

describe('pageMetadata', () => {
  it('sets canonical, og, twitter, truncates description', () => {
    const m = pageMetadata({ title: 'Shop', description: 'x'.repeat(300), path: '/shop' });
    expect(m.alternates?.canonical).toBe('/shop');
    expect((m.description as string).length).toBeLessThanOrEqual(160);
    expect(m.openGraph).toMatchObject({ title: 'Shop', url: '/shop', type: 'website', locale: 'en_IN' });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(m.robots).toBeUndefined();
  });
  it('noindex,follow when requested', () => {
    expect(pageMetadata({ title: 'a', description: 'b', path: '/shop', noindex: true }).robots).toEqual({ index: false, follow: true });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/jsonld.test.ts tests/meta.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/jsonld.ts`:
```ts
import { abs, SITE } from './site';
import { productSlug, workshopSlug } from './catalog';
import type { Product, Workshop } from './types';

const CTX = 'https://schema.org';
const price = (paise: number) => (paise / 100).toFixed(2);

export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export const organizationJsonLd = () => ({
  '@context': CTX, '@type': 'Organization',
  name: SITE.name, url: abs('/'), description: SITE.description,
  areaServed: { '@type': 'AdministrativeArea', name: 'Rajasthan, India' },
});

export const websiteJsonLd = () => ({
  '@context': CTX, '@type': 'WebSite',
  name: SITE.name, url: abs('/'), inLanguage: 'en-IN',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${abs('/shop')}?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
});

export function productJsonLd(p: Product) {
  const path = `/products/${productSlug(p)}`;
  return {
    '@context': CTX, '@type': 'Product',
    name: p.name, description: p.description, sku: p.id, category: p.category,
    image: [abs(`${path}/opengraph-image`)],
    brand: { '@type': 'Brand', name: p.seller },
    offers: {
      '@type': 'Offer', url: abs(path), priceCurrency: 'INR', price: price(p.pricePaise),
      availability: `https://schema.org/${p.stock > 0 ? 'InStock' : 'OutOfStock'}`,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: p.seller },
    },
  };
}

export function workshopJsonLd(w: Workshop) {
  const path = `/workshops/${workshopSlug(w)}`;
  const left = Math.max(0, w.seats - w.booked);
  return {
    '@context': CTX, '@type': 'Event',
    name: w.title, description: w.description, url: abs(path),
    image: [abs(`${path}/opengraph-image`)],
    startDate: `${w.date}T${w.time}:00+05:30`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place', name: w.venue,
      address: { '@type': 'PostalAddress', addressLocality: w.city, addressRegion: 'Rajasthan', addressCountry: 'IN' },
    },
    organizer: { '@type': 'Organization', name: w.host },
    maximumAttendeeCapacity: w.seats,
    remainingAttendeeCapacity: left,
    offers: {
      '@type': 'Offer', url: abs(path), priceCurrency: 'INR', price: price(w.pricePaise),
      availability: `https://schema.org/${left > 0 ? 'InStock' : 'SoldOut'}`,
    },
  };
}

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  '@context': CTX, '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});
```

`src/lib/meta.ts`:
```ts
import type { Metadata } from 'next';
import { SITE } from './site';
import { truncate } from './format';

export function pageMetadata(o: { title: string; description: string; path: string; noindex?: boolean; image?: string }): Metadata {
  const description = truncate(o.description, 160);
  return {
    title: o.title,
    description,
    alternates: { canonical: o.path },
    ...(o.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: o.title, description, url: o.path, siteName: SITE.name,
      locale: SITE.locale, type: 'website',
      ...(o.image ? { images: [o.image] } : {}),
    },
    twitter: { card: 'summary_large_image', title: o.title, description },
  };
}
```
Note: when a route has an `opengraph-image` file convention, Next injects `og:image` automatically; pass `image` only for pages without one.

`src/components/JsonLd.tsx`:
```tsx
import { serializeJsonLd } from '@/lib/jsonld';

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
```

- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: JSON-LD builders and page metadata helper"`

---

### Task 7: Global layout, styles, fonts, header/footer

**Files:**
- Create: `src/app/globals.css`, `src/components/Header.tsx`, `Footer.tsx`, `Breadcrumbs.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `SITE`, `siteUrl`, `JsonLd`, `organizationJsonLd`, `websiteJsonLd`; client components from Task 8 (`StoreProvider`, `CartButton`) — create Task 8 first or stub; **execute Task 8 before the `StoreProvider`/`CartButton` wiring in this task's layout** (the plan keeps them separate; if running linearly, write layout without them now and add in Task 8 Step 5).
- Produces: `<Breadcrumbs items={{name:string; path:string}[]} />` (visible nav + no JSON-LD; pages add JSON-LD themselves), CSS classes `.skip-link`, `.crumbs`, `.detail*`, `.sr-only`.

- [ ] **Step 1: Port CSS**

```bash
sed -e '1d' \
    -e "s/'DM Sans',sans-serif/var(--font-sans),sans-serif/g" \
    -e "s/'Playfair Display',serif/var(--font-serif),serif/g" \
    legacy/styles.css > src/app/globals.css
grep -c "fonts.googleapis" src/app/globals.css   # expect 0
grep -c "var(--font-" src/app/globals.css          # expect > 20
```
Append to `src/app/globals.css`:
```css
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.skip-link{position:absolute;left:12px;top:-60px;background:var(--green);color:#fff;padding:10px 14px;border-radius:3px;z-index:30}
.skip-link:focus{top:12px}
:focus-visible{outline:2px solid var(--orange);outline-offset:2px}
.crumbs{font-size:11px;color:var(--muted);padding:22px 8.5% 0}
.crumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0}
.crumbs li+li:before{content:'/';margin-right:8px}
.crumbs a:hover{color:var(--orange)}
.page-head{padding:40px 8.5% 0}
.page-head h1{font:500 clamp(34px,4.5vw,52px)/1.1 var(--font-serif),serif;letter-spacing:-1.2px;margin:12px 0}
.page-head p{max-width:560px;color:var(--muted);font-size:13px;line-height:1.8}
.detail{display:grid;grid-template-columns:1fr 1fr;gap:6%;padding:40px 8.5% 80px;align-items:start}
.detail .product-visual,.detail .detail-art{height:380px}
.detail h1{font:500 clamp(30px,4vw,44px)/1.1 var(--font-serif),serif;letter-spacing:-1px;margin:10px 0 16px}
.detail .lead{font-size:14px;line-height:1.8;color:#6e7068}
.detail dl{display:grid;grid-template-columns:auto 1fr;gap:8px 18px;font-size:12px;margin:24px 0}
.detail dt{color:var(--muted)}
.detail .price{font-size:22px}
.filters button{border:0;background:var(--green);color:#fff;border-radius:3px;padding:0 16px;font:600 11px var(--font-sans),sans-serif;cursor:pointer}
.link-row{display:flex;flex-wrap:wrap;gap:10px;padding:0 8.5% 60px}
.link-row a{border:1px solid var(--line);padding:8px 14px;border-radius:30px;font-size:11px;font-weight:600}
.link-row a:hover{border-color:var(--orange);color:var(--orange)}
@media(max-width:700px){.detail{grid-template-columns:1fr}.detail .product-visual,.detail .detail-art{height:260px}.crumbs,.page-head,.link-row{padding-left:5%;padding-right:5%}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.button{transition:none}}
```
(Legacy `.filters` used `<input>` + `<select>` in a div; `FilterForm` in Task 9 reuses that class on a `<form>`.)

- [ ] **Step 2: `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { SITE, siteUrl } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/jsonld';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const sans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });
const serif = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: '/' },
  openGraph: { siteName: SITE.name, locale: SITE.locale, type: 'website' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export const viewport: Viewport = { themeColor: '#f8f4ee', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Components**

`Header.tsx` (server; `CartButton` added in Task 8):
```tsx
import Link from 'next/link';

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Rang Rajasthan home">
      <span className="brand-mark" aria-hidden="true">✿</span>
      <span><b>rang rajasthan</b><small>MADE BY HAND, SHARED WITH HEART</small></span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="topbar">
      <Brand />
      <nav aria-label="Primary">
        <Link href="/shop">Shop handmade</Link>
        <Link href="/workshops">Workshops &amp; pop-ups</Link>
        {/* CartButton inserted in Task 8 */}
      </nav>
    </header>
  );
}
```
`Footer.tsx`:
```tsx
import Link from 'next/link';
import { Brand } from './Header';
import { CITIES, citySlug } from '@/lib/catalog';

export function Footer() {
  return (
    <footer>
      <Brand />
      <nav aria-label="Cities" style={{ display: 'flex', gap: 14, fontSize: 11 }}>
        {CITIES.map(c => <Link key={c} href={`/cities/${citySlug(c)}`}>{c}</Link>)}
      </nav>
      <p>A demo marketplace concept for Rajasthan. Payments are not enabled.</p>
      <span>Made with care ✳</span>
    </footer>
  );
}
```
`Breadcrumbs.tsx`:
```tsx
import Link from 'next/link';

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((it, i) => (
          <li key={it.path}>
            {i === items.length - 1 ? <span aria-current="page">{it.name}</span> : <Link href={it.path}>{it.name}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```
`not-found.tsx` (Next returns HTTP 404 for it):
```tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <section className="page-head" style={{ paddingBottom: 80 }}>
      <span className="eyebrow">404</span>
      <h1>We couldn’t find that page.</h1>
      <p>It may have sold out, moved, or never existed.</p>
      <p><Link className="text-link" href="/shop">Browse handmade finds →</Link> · <Link className="text-link" href="/workshops">Find a workshop →</Link></p>
    </section>
  );
}
```
`error.tsx`:
```tsx
'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="page-head" style={{ paddingBottom: 80 }}>
      <h1>Something went wrong.</h1>
      <p>Please try again.</p>
      <button className="button primary" onClick={reset}>Try again</button>
    </section>
  );
}
```

- [ ] **Step 4: Verify** — `npx next build` succeeds. Then `npx next start -p 3100 &` and `curl -s localhost:3100 | grep -o '<html[^>]*>'` → contains `lang="en-IN"`; `curl -s localhost:3100 | grep -c 'application/ld+json'` → 1; `curl -s localhost:3100 | grep -o '<link rel="canonical"[^>]*>'` → canonical present. Kill server.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: layout, fonts, global styles, header/footer, 404"`

---

### Task 8: Client islands — store, cart, booking, toast

**Files:**
- Create: `src/components/StoreProvider.tsx`, `CartButton.tsx`, `CartDialog.tsx`, `BookingDialog.tsx`, `AddToCartButton.tsx`, `ReserveButton.tsx`
- Modify: `src/app/layout.tsx`, `src/components/Header.tsx`

**Interfaces:**
- Consumes: `Product`, `Workshop`, `money`, `/api/orders`, `/api/bookings`.
- Produces: `useStore(): { items: CartItem[]; count:number; total:number; addToCart(p:Product):void; removeFromCart(id:string):void; cartOpen:boolean; setCartOpen(b:boolean):void; booking: Workshop|null; openBooking(w:Workshop):void; closeBooking():void; notify(msg:string):void; checkout(f:{customerName:string; email:string}):Promise<void>; reserve(f:{workshopId:string; attendeeName:string; email:string; quantity:number}):Promise<void> }` where `type CartItem = { productId:string; name:string; pricePaise:number; stock:number; quantity:number }`; components `<AddToCartButton product={Product}/>`, `<ReserveButton workshop={Workshop}/>`, `<CartButton/>`.
- Behavior: cart persists in `localStorage` key `rr-cart` (read in `useEffect` only → no hydration mismatch; every storage access in try/catch). After a successful order/booking call `router.refresh()`. Failed calls `notify(error)` and refresh.

- [ ] **Step 1: `StoreProvider.tsx`**

```tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, Workshop } from '@/lib/types';
import { money } from '@/lib/money';
import { CartDialog } from './CartDialog';
import { BookingDialog } from './BookingDialog';

export type CartItem = { productId: string; name: string; pricePaise: number; stock: number; quantity: number };
type Store = {
  items: CartItem[]; count: number; total: number;
  addToCart(p: Product): void; removeFromCart(id: string): void;
  cartOpen: boolean; setCartOpen(b: boolean): void;
  booking: Workshop | null; openBooking(w: Workshop): void; closeBooking(): void;
  notify(msg: string): void;
  checkout(f: { customerName: string; email: string }): Promise<void>;
  reserve(f: { workshopId: string; attendeeName: string; email: string; quantity: number }): Promise<void>;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
};

async function api<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data as T;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [booking, setBooking] = useState<Workshop | null>(null);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rr-cart');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed.filter(i => i && typeof i.productId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0));
      }
    } catch {}
    hydrated.current = true;
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem('rr-cart', JSON.stringify(items)); } catch {}
  }, [items]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3000);
  }, []);

  const addToCart = useCallback((p: Product) => {
    setItems(cur => {
      const ex = cur.find(i => i.productId === p.id);
      if ((ex?.quantity ?? 0) >= p.stock) { notify('That is all the stock currently available.'); return cur; }
      notify(`${p.name} added to your bag.`);
      return ex
        ? cur.map(i => (i.productId === p.id ? { ...i, quantity: i.quantity + 1, stock: p.stock } : i))
        : [...cur, { productId: p.id, name: p.name, pricePaise: p.pricePaise, stock: p.stock, quantity: 1 }];
    });
  }, [notify]);

  const removeFromCart = useCallback((id: string) => setItems(cur => cur.filter(i => i.productId !== id)), []);

  const checkout: Store['checkout'] = async f => {
    if (!items.length) return notify('Your bag is empty.');
    try {
      const order = await api<{ totalPaise: number }>('/api/orders', {
        ...f, items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      });
      setItems([]); setCartOpen(false);
      notify(`Demo order created! Total ${money(order.totalPaise)}. No payment collected.`);
    } catch (e) { notify((e as Error).message); }
    router.refresh();
  };

  const reserve: Store['reserve'] = async f => {
    try {
      const b = await api<{ status: string; title: string }>('/api/bookings', f);
      setBooking(null);
      notify(`${b.status.includes('FREE') ? 'Free spot confirmed' : 'Demo booking created'} — ${b.title}. No payment collected.`);
    } catch (e) { notify((e as Error).message); }
    router.refresh();
  };

  const value = useMemo<Store>(() => ({
    items, count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.pricePaise * i.quantity, 0),
    addToCart, removeFromCart, cartOpen, setCartOpen,
    booking, openBooking: setBooking, closeBooking: () => setBooking(null),
    notify, checkout, reserve,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, cartOpen, booking, addToCart, removeFromCart, notify]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <CartDialog />
      <BookingDialog />
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </Ctx.Provider>
  );
}
```
Note: `checkout`/`reserve` close over `items`/`router`, so they must be recreated when `items` changes — `items` is already in the deps array; `router` is stable.

- [ ] **Step 2: Dialogs**

`CartDialog.tsx`:
```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useStore } from './StoreProvider';
import { money } from '@/lib/money';

export function CartDialog() {
  const { items, total, removeFromCart, cartOpen, setCartOpen, checkout } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (cartOpen && !d.open) d.showModal();
    if (!cartOpen && d.open) d.close();
  }, [cartOpen]);
  return (
    <dialog ref={ref} onClose={() => setCartOpen(false)} aria-labelledby="cart-title">
      <div className="dialog-head">
        <h2 id="cart-title">Your bag</h2>
        <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close bag">✕</button>
      </div>
      {items.length === 0 ? (
        <p className="empty-cart">Your bag is waiting for something lovely.</p>
      ) : items.map(i => (
        <div className="cart-line" key={i.productId}>
          <div>{i.name}<small>{money(i.pricePaise)} × {i.quantity}</small></div>
          <div><b>{money(i.pricePaise * i.quantity)}</b><br /><button onClick={() => removeFromCart(i.productId)}>Remove</button></div>
        </div>
      ))}
      <div className="cart-total"><span>Subtotal</span><b>{money(total)}</b></div>
      <form onSubmit={async e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        await checkout({ customerName: String(f.get('customerName')), email: String(f.get('email')) });
        form.reset();
      }}>
        <label>Your name<input name="customerName" required placeholder="Name" /></label>
        <label>Email<input name="email" type="email" required placeholder="you@example.com" /></label>
        <button className="button primary full" type="submit">Place demo order</button>
        <p className="fine-print">Demo checkout only. No payment is collected.</p>
      </form>
    </dialog>
  );
}
```
`BookingDialog.tsx`:
```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useStore } from './StoreProvider';

export function BookingDialog() {
  const { booking, closeBooking, reserve } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (booking && !d.open) d.showModal();
    if (!booking && d.open) d.close();
  }, [booking]);
  const max = booking ? Math.min(4, booking.seats - booking.booked) : 1;
  return (
    <dialog ref={ref} onClose={closeBooking} aria-labelledby="booking-title">
      <div className="dialog-head">
        <h2 id="booking-title">{booking?.type === 'FREE' ? 'Reserve your free spot' : 'Reserve a spot'}</h2>
        <button className="icon-btn" onClick={closeBooking} aria-label="Close booking">✕</button>
      </div>
      {booking && (
        <form onSubmit={async e => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const form = e.currentTarget;
          await reserve({ workshopId: booking.id, attendeeName: String(f.get('attendeeName')), email: String(f.get('email')), quantity: Number(f.get('quantity')) });
          form.reset();
        }}>
          <label>Your name<input name="attendeeName" required placeholder="Name" /></label>
          <label>Email<input name="email" type="email" required placeholder="you@example.com" /></label>
          <label>Number of seats
            <select name="quantity">
              {Array.from({ length: Math.max(1, max) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} seat{i ? 's' : ''}</option>)}
            </select>
          </label>
          <button className="button primary full" type="submit">Reserve demo spot</button>
          <p className="fine-print">Demo booking only. Paid workshops do not collect payment.</p>
        </form>
      )}
    </dialog>
  );
}
```
`CartButton.tsx`:
```tsx
'use client';
import { useStore } from './StoreProvider';

export function CartButton() {
  const { count, setCartOpen } = useStore();
  return <button className="cart-btn" onClick={() => setCartOpen(true)} aria-haspopup="dialog">Bag <span aria-label={`${count} items`}>{count}</span></button>;
}
```
`AddToCartButton.tsx`:
```tsx
'use client';
import type { Product } from '@/lib/types';
import { useStore } from './StoreProvider';

export function AddToCartButton({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const soldOut = product.stock < 1;
  return <button className="add-btn" disabled={soldOut} onClick={() => addToCart(product)}>{soldOut ? 'Sold out' : '+ Add to bag'}</button>;
}
```
`ReserveButton.tsx`:
```tsx
'use client';
import type { Workshop } from '@/lib/types';
import { useStore } from './StoreProvider';

export function ReserveButton({ workshop }: { workshop: Workshop }) {
  const { openBooking } = useStore();
  const full = workshop.seats - workshop.booked < 1;
  return <button disabled={full} onClick={() => openBooking(workshop)}>{full ? 'Full' : 'Reserve spot ↗'}</button>;
}
```

- [ ] **Step 2: Wire into layout/header** — in `layout.tsx` wrap `<Header/> <main/> <Footer/>` with `<StoreProvider>`; in `Header.tsx` replace the comment with `<CartButton />` (import from `./CartButton`). `Header` stays a server component; `CartButton` is the client island. Skip-link and JsonLd stay outside provider.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors; `npx next build` → succeeds.

- [ ] **Step 4: Commit** `git add -A && git commit -m "feat: client cart, booking, toast islands"`

---

### Task 9: Home, /shop, /workshops pages (server-rendered, crawlable filters)

**Files:**
- Create: `src/components/{Hero,ProductCard,ProductGrid,WorkshopCard,WorkshopList,FilterForm}.tsx`, `src/app/shop/page.tsx`, `src/app/workshops/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: catalog, filters, `pageMetadata`, `JsonLd`, `ProductJsonLd` shapes, `AddToCartButton`, `ReserveButton`.
- Produces:
  - `<ProductGrid products={Product[]} />`, `<WorkshopList workshops={Workshop[]} />`, `visualIndex(id:string): number` exported from `ProductCard.tsx`
  - `<FilterForm action="/shop"|"/workshops" values={Filters} kind="products"|"workshops" />` — plain `<form method="get">` (works without JS; each filtered view is a shareable URL)
  - Filtered pages: `robots: noindex,follow`, canonical `/shop` or `/workshops`.

- [ ] **Step 1: Components**

`ProductCard.tsx`:
```tsx
import Link from 'next/link';
import type { Product } from '@/lib/types';
import { money } from '@/lib/money';
import { productSlug } from '@/lib/catalog';
import { AddToCartButton } from './AddToCartButton';

export const SYMBOLS = ['🌷', '⛵', '🌼', '🏺', '🧶', '🌸'];
export const visualIndex = (id: string) => Number(id.replace(/\D/g, '')) || 0;

export function ProductCard({ p }: { p: Product }) {
  const i = visualIndex(p.id);
  return (
    <article className="product-card">
      <div className={`product-visual visual-${i % 4}`} aria-hidden="true"><span className="symbol">{SYMBOLS[i % SYMBOLS.length]}</span></div>
      <div className="product-info">
        <span className="product-meta">{p.category} · {p.city}</span>
        <h3><Link href={`/products/${productSlug(p)}`}>{p.name}</Link></h3>
        <p>{p.description}<br />By {p.seller}</p>
        <div className="product-bottom">
          <span className="price">{money(p.pricePaise)}</span>
          <AddToCartButton product={p} />
        </div>
      </div>
    </article>
  );
}
```
`ProductGrid.tsx`:
```tsx
import type { Product } from '@/lib/types';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <div className="product-grid"><div className="empty">No finds match those filters. Try another city or search.</div></div>;
  return <div className="product-grid">{products.map(p => <ProductCard key={p.id} p={p} />)}</div>;
}
```
`WorkshopCard.tsx` / `WorkshopList.tsx`:
```tsx
import Link from 'next/link';
import type { Workshop } from '@/lib/types';
import { money } from '@/lib/money';
import { formatDay } from '@/lib/format';
import { workshopSlug } from '@/lib/catalog';
import { ReserveButton } from './ReserveButton';

export function WorkshopCard({ w }: { w: Workshop }) {
  const { day, month } = formatDay(w.date);
  const left = w.seats - w.booked;
  return (
    <article className="workshop-card">
      <div className="date-tile"><b>{day}</b><span>{month} · {w.city}</span></div>
      <div>
        <h3><Link href={`/workshops/${workshopSlug(w)}`}>{w.title}</Link></h3>
        <p>{w.venue} · <time dateTime={`${w.date}T${w.time}+05:30`}>{w.time}</time><br />{w.host} · {left} seats left</p>
      </div>
      <div className="workshop-price"><b>{w.type === 'FREE' ? 'Free' : money(w.pricePaise)}</b><ReserveButton workshop={w} /></div>
    </article>
  );
}
```
```tsx
// WorkshopList.tsx
import type { Workshop } from '@/lib/types';
import { WorkshopCard } from './WorkshopCard';

export function WorkshopList({ workshops }: { workshops: Workshop[] }) {
  if (!workshops.length) return <div className="workshop-list"><div className="empty">No workshops found. Try a different city or filter.</div></div>;
  return <div className="workshop-list">{workshops.map(w => <WorkshopCard key={w.id} w={w} />)}</div>;
}
```
`FilterForm.tsx`:
```tsx
import Link from 'next/link';
import { CITIES, CATEGORIES } from '@/lib/catalog';
import type { Filters } from '@/lib/filters';

export function FilterForm({ action, kind, values }: { action: '/shop' | '/workshops'; kind: 'products' | 'workshops'; values: Filters }) {
  return (
    <form className="filters" action={action} method="get" role="search">
      <input name="q" defaultValue={values.q} placeholder={kind === 'products' ? 'Search crafts, makers…' : 'Search workshops…'} aria-label={kind === 'products' ? 'Search products' : 'Search workshops'} maxLength={100} />
      <select name="city" defaultValue={values.city ?? ''} aria-label="Filter by city">
        <option value="">All Rajasthan</option>
        {CITIES.map(c => <option key={c}>{c}</option>)}
      </select>
      {kind === 'products' ? (
        <select name="category" defaultValue={values.category ?? ''} aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      ) : (
        <select name="type" defaultValue={values.type ?? ''} aria-label="Filter by price">
          <option value="">Free &amp; paid</option>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
        </select>
      )}
      <button type="submit">Search</button>
      {Object.keys(values).length > 0 && <Link className="text-link" href={action}>Clear</Link>}
    </form>
  );
}
```
`Hero.tsx`: port the `<section class="hero">…</section>` and `<section class="intro">…</section>` markup from `legacy/index.html` verbatim as JSX (`class`→`className`; `<br>`→`<br />`; `href="#shop"`→`<Link href="/shop">`, `href="#workshops"`→`<Link href="/workshops">`). Keep the single `<h1>`.

- [ ] **Step 2: `src/app/page.tsx`**

```tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { ProductGrid } from '@/components/ProductGrid';
import { WorkshopList } from '@/components/WorkshopList';
import { listProducts, listWorkshops, CITIES, citySlug } from '@/lib/catalog';
import { pageMetadata } from '@/lib/meta';
import { SITE } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  path: '/',
});

export default async function Home() {
  const [products, workshops] = await Promise.all([listProducts(), listWorkshops()]);
  return (
    <>
      <Hero />
      <section className="section" id="shop" aria-labelledby="shop-h">
        <div className="section-heading">
          <div><span className="eyebrow">THE MAKERS&apos; SHELF</span><h2 id="shop-h">Handmade finds</h2></div>
          <Link className="text-link" href="/shop">Browse &amp; filter all →</Link>
        </div>
        <div style={{ height: 24 }} />
        <ProductGrid products={products} />
      </section>
      <section className="workshop-band" id="workshops" aria-labelledby="ws-h">
        <div className="workshop-intro">
          <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
          <h2 id="ws-h">Make time for<br /><em>making things.</em></h2>
          <p>Find friendly workshops, creative meetups and pop-up experiences hosted by local makers and venues.</p>
          <p><Link className="text-link" href="/workshops">Browse &amp; filter all →</Link></p>
        </div>
        <WorkshopList workshops={workshops} />
      </section>
      <section className="maker-cta">
        <div className="cta-flower" aria-hidden="true">✿</div>
        <div>
          <span className="eyebrow">YOUR HANDS MAKE SOMETHING SPECIAL?</span>
          <h2>There’s room for your craft here.</h2>
          <p>This demo shows the customer experience. Seller onboarding and listing approval will be added in the next build.</p>
        </div>
        <a className="button light" href={`mailto:${SITE.email}?subject=Marketplace%20seller%20interest`}>I’m a maker <span>↗</span></a>
      </section>
      <nav className="link-row" aria-label="Explore by city">
        {CITIES.map(c => <Link key={c} href={`/cities/${citySlug(c)}`}>Handmade &amp; workshops in {c}</Link>)}
      </nav>
    </>
  );
}
```

- [ ] **Step 3: `/shop` and `/workshops`**

`src/app/shop/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FilterForm } from '@/components/FilterForm';
import { ProductGrid } from '@/components/ProductGrid';
import { JsonLd } from '@/components/JsonLd';
import { listProducts } from '@/lib/catalog';
import { hasFilters, parseFilters } from '@/lib/filters';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  return pageMetadata({
    title: 'Shop handmade crafts from Rajasthan',
    description: 'Crochet, resin art, pottery and accessories from independent makers in Udaipur, Jaipur and Jodhpur. Search by city and category.',
    path: '/shop',
    noindex: hasFilters(f),
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const products = await listProducts(f);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">THE MAKERS&apos; SHELF</span>
        <h1>Handmade finds from Rajasthan</h1>
        <p>{products.length} {products.length === 1 ? 'find' : 'finds'} to love{f.city ? ` in ${f.city}` : ''}.</p>
      </div>
      <section className="section" style={{ paddingTop: 10 }}>
        <FilterForm action="/shop" kind="products" values={f} />
        <ProductGrid products={products} />
      </section>
    </>
  );
}
```
`src/app/workshops/page.tsx`: same shape — title `Creative workshops & pop-ups in Rajasthan`, description `Hands-on crochet, painting and maker meetups hosted by local studios and cafés in Udaipur, Jaipur and Jodhpur. Free and paid.`, `path: '/workshops'`, `FilterForm action="/workshops" kind="workshops"`, `listWorkshops(f)`, `<WorkshopList>` inside `<section className="workshop-band" style={{display:'block'}}>`, h1 `Creative workshops & pop-ups`.

- [ ] **Step 4: Verify (JS-free content + filter SEO)**

```bash
npx next build && (npx next start -p 3100 & sleep 3)
curl -s localhost:3100/ | grep -c "Crochet Lily Bouquet"          # >= 1 (SSR content)
curl -s localhost:3100/shop | grep -o '<h1[^>]*>[^<]*'            # exactly one
curl -s 'localhost:3100/shop?city=Jaipur' | grep -o '<meta name="robots"[^>]*>'   # noindex,follow
curl -s 'localhost:3100/shop?city=Jaipur' | grep -o '<link rel="canonical"[^>]*>' # href ends with /shop
curl -s -o /dev/null -w '%{http_code}\n' "localhost:3100/shop?city=a&city=b&q=$(printf 'x%.0s' {1..10000})"   # 200
```
Expected as annotated. Leave server for Task 10/11 or `kill %1`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: SSR home, shop and workshops pages with crawlable filters"`

---

### Task 10: Detail pages, city landing pages, OG images

**Files:**
- Create: `src/app/products/[slug]/page.tsx`, `src/app/products/[slug]/opengraph-image.tsx`, `src/app/workshops/[slug]/page.tsx`, `src/app/workshops/[slug]/opengraph-image.tsx`, `src/app/cities/[city]/page.tsx`, `src/app/opengraph-image.tsx`, `src/lib/og.tsx`

**Interfaces:**
- Consumes: `getProductBySlug`, `getWorkshopBySlug`, `cityFromSlug`, `productJsonLd`, `workshopJsonLd`, `breadcrumbJsonLd`, `pageMetadata`, `JsonLd`, `Breadcrumbs`, `AddToCartButton`, `ReserveButton`.
- Produces: `renderOg(title:string, subtitle:string): ImageResponse`; routes `/products/{name}-{id}`, `/workshops/{title}-{id}`, `/cities/{udaipur|jaipur|jodhpur}`. Unknown slug → `notFound()` (HTTP 404). Cities use `dynamicParams = false`.

- [ ] **Step 1: `src/lib/og.tsx`**

```tsx
import { ImageResponse } from 'next/og';

export const ogSize = { width: 1200, height: 630 };

export function renderOg(title: string, subtitle: string) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f8f4ee', padding: 72, color: '#252a24' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#c66b43', letterSpacing: 4 }}>RANG RAJASTHAN</div>
        <div style={{ display: 'flex', fontSize: 76, lineHeight: 1.1, fontWeight: 600 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 34, color: '#405746' }}>{subtitle}</div>
      </div>
    ),
    ogSize,
  );
}
```
`src/app/opengraph-image.tsx`:
```tsx
import { renderOg, ogSize } from '@/lib/og';
export const alt = 'Rang Rajasthan — handmade finds and creative workshops';
export const size = ogSize;
export const contentType = 'image/png';
export default function Image() { return renderOg('Good things are made by hand.', 'Handmade finds & workshops in Rajasthan'); }
```
Product OG (`products/[slug]/opengraph-image.tsx`):
```tsx
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/catalog';
import { money } from '@/lib/money';
import { renderOg, ogSize } from '@/lib/og';

export const alt = 'Handmade product from Rajasthan';
export const size = ogSize;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProductBySlug((await params).slug);
  if (!p) notFound();
  return renderOg(p.name, `${money(p.pricePaise)} · by ${p.seller} · ${p.city}`);
}
```
Workshop OG: same with `getWorkshopBySlug`, subtitle `${w.date} · ${w.venue}, ${w.city}`.

- [ ] **Step 2: Product detail page**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AddToCartButton } from '@/components/AddToCartButton';
import { SYMBOLS, visualIndex } from '@/components/ProductCard';
import { citySlug, getProductBySlug, listProducts, productSlug } from '@/lib/catalog';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { money } from '@/lib/money';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await listProducts()).map(p => ({ slug: productSlug(p) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  return pageMetadata({
    title: `${p.name} — handmade in ${p.city}`,
    description: `${p.description} Handmade by ${p.seller} in ${p.city}. ${money(p.pricePaise)}.`,
    path: `/products/${productSlug(p)}`,
  });
}

export default async function ProductPage({ params }: Props) {
  const p = await getProductBySlug((await params).slug);
  if (!p) notFound();
  const i = visualIndex(p.id);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: p.name, path: `/products/${productSlug(p)}` }];
  return (
    <>
      <JsonLd data={[productJsonLd(p), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <article className="detail">
        <div className={`product-visual detail-art visual-${i % 4}`} aria-hidden="true"><span className="symbol">{SYMBOLS[i % SYMBOLS.length]}</span></div>
        <div>
          <span className="product-meta">{p.category}</span>
          <h1>{p.name}</h1>
          <p className="lead">{p.description}</p>
          <dl>
            <dt>Maker</dt><dd>{p.seller}</dd>
            <dt>City</dt><dd><Link href={`/cities/${citySlug(p.city)}`}>{p.city}</Link></dd>
            <dt>Availability</dt><dd>{p.stock > 0 ? `${p.stock} in stock` : 'Sold out'}</dd>
          </dl>
          <div className="product-bottom" style={{ gap: 20, justifyContent: 'flex-start' }}>
            <span className="price">{money(p.pricePaise)}</span>
            <AddToCartButton product={p} />
          </div>
          <p className="fine-print" style={{ textAlign: 'left' }}>Demo checkout only. No payment is collected.</p>
        </div>
      </article>
    </>
  );
}
```
(`notFound()` inside a page with `generateStaticParams` and default `dynamicParams=true` yields a real 404 response.)

- [ ] **Step 3: Workshop detail page** — mirror Step 2 with `getWorkshopBySlug`, `workshopSlug`, `workshopJsonLd`. Title `${w.title} — workshop in ${w.city}`; description `${w.description} ${w.date} at ${w.venue}, ${w.city}. Hosted by ${w.host}. ${w.type === 'FREE' ? 'Free' : money(w.pricePaise)}.`; breadcrumbs Home › Workshops › title; `<dl>` rows When (`<time dateTime=...>` using `formatDay`+ time), Where, Host, Seats left, Price; `<ReserveButton workshop={w} />`; `<JsonLd data={[workshopJsonLd(w), breadcrumbJsonLd(crumbs)]} />`; right column art: `<div className="date-tile">` large day/month. Include the same `notFound()` guard and `generateStaticParams`.

- [ ] **Step 4: City landing page** `src/app/cities/[city]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { WorkshopList } from '@/components/WorkshopList';
import { CITIES, citySlug, cityFromSlug, listProducts, listWorkshops } from '@/lib/catalog';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const dynamicParams = false;
type Props = { params: Promise<{ city: string }> };

export const generateStaticParams = () => CITIES.map(c => ({ city: citySlug(c) }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = cityFromSlug((await params).city);
  if (!city) return { title: 'City not found', robots: { index: false } };
  return pageMetadata({
    title: `Handmade finds & creative workshops in ${city}`,
    description: `Shop handmade crafts by ${city} makers and book creative workshops and meetups in ${city}, Rajasthan.`,
    path: `/cities/${citySlug(city)}`,
  });
}

export default async function CityPage({ params }: Props) {
  const city = cityFromSlug((await params).city);
  if (!city) notFound();
  const [products, workshops] = await Promise.all([listProducts({ city }), listWorkshops({ city })]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: city, path: `/cities/${citySlug(city)}` }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">{city.toUpperCase()}, RAJASTHAN</span>
        <h1>Handmade finds &amp; workshops in {city}</h1>
        <p>Independent makers and creative gatherings in {city}.</p>
      </div>
      <section className="section" aria-labelledby="c-shop"><h2 id="c-shop">Handmade in {city}</h2><div style={{ height: 20 }} /><ProductGrid products={products} /></section>
      <section className="workshop-band" style={{ display: 'block' }} aria-labelledby="c-ws"><h2 id="c-ws" style={{ marginTop: 0 }}>Workshops in {city}</h2><WorkshopList workshops={workshops} /></section>
    </>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npx next build && (npx next start -p 3100 & sleep 3)
for u in /products/crochet-lily-bouquet-p1 /workshops/beginner-crochet-make-your-first-flower-w1 /cities/jaipur; do curl -s -o /dev/null -w "$u %{http_code}\n" localhost:3100$u; done   # 200 x3
for u in /products/anything-p1 /products/nope /workshops/x-w1 /cities/delhi; do curl -s -o /dev/null -w "$u %{http_code}\n" localhost:3100$u; done                              # 404 x4
curl -s localhost:3100/products/crochet-lily-bouquet-p1 | grep -o '"@type":"Product"'     # present
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' localhost:3100/products/crochet-lily-bouquet-p1/opengraph-image   # 200 image/png
```
Expected as annotated.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: product/workshop/city pages with JSON-LD and OG images"`

---

### Task 11: sitemap, robots, manifest, SEO check script, docs, remove legacy

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/manifest.ts`, `scripts/seo-check.mjs`
- Modify: `README.md`
- Delete: `legacy/`

**Interfaces:**
- Consumes: `abs`, catalog functions, `SITE`.
- Produces: `/sitemap.xml` (home, /shop, /workshops, 3 city pages, every approved product & workshop; no `/api`, no filtered URLs), `/robots.txt` (allow `/`, disallow `/api/`, `Sitemap:` line), `/manifest.webmanifest`.

- [ ] **Step 1: Implement**

`sitemap.ts`:
```ts
import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';
import { CITIES, citySlug, listProducts, listWorkshops, productSlug, workshopSlug } from '@/lib/catalog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, workshops] = await Promise.all([listProducts(), listWorkshops()]);
  return [
    { url: abs('/'), changeFrequency: 'weekly', priority: 1 },
    { url: abs('/shop'), changeFrequency: 'daily', priority: 0.9 },
    { url: abs('/workshops'), changeFrequency: 'daily', priority: 0.9 },
    ...CITIES.map(c => ({ url: abs(`/cities/${citySlug(c)}`), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...products.map(p => ({ url: abs(`/products/${productSlug(p)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...workshops.map(w => ({ url: abs(`/workshops/${workshopSlug(w)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
```
(No `lastModified`: data has no real modification timestamps; a fake "now" teaches crawlers to ignore the field.)

`robots.ts`:
```ts
import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: abs('/sitemap.xml'),
  };
}
```
`manifest.ts`:
```ts
import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return { name: SITE.name, short_name: 'Rang', description: SITE.description, start_url: '/', display: 'standalone', background_color: '#f8f4ee', theme_color: '#405746', lang: 'en-IN' };
}
```
Also add an app icon: `src/app/icon.tsx` using `ImageResponse` (32×32, green circle with `✿`-free text "R") —
```tsx
import { ImageResponse } from 'next/og';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';
export default function Icon() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#405746', color: '#fff5e9', fontSize: 22, borderRadius: 16 }}>R</div>, size);
}
```

- [ ] **Step 2: `scripts/seo-check.mjs`** (post-build assertions, run against a running server)

```js
const BASE = process.env.BASE_URL || 'http://localhost:3100';
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const get = async p => { const r = await fetch(BASE + p, { redirect: 'manual' }); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') || '' }; };

const pages = ['/', '/shop', '/workshops', '/cities/jaipur', '/products/crochet-lily-bouquet-p1', '/workshops/beginner-crochet-make-your-first-flower-w1'];
for (const p of pages) {
  const { status, text } = await get(p);
  ok(status === 200, `${p} → 200`);
  ok((text.match(/<h1[\s>]/g) || []).length === 1, `${p} has exactly one <h1>`);
  ok(/<title>[^<]{10,}<\/title>/.test(text), `${p} has <title>`);
  const desc = /<meta name="description" content="([^"]*)"/.exec(text);
  ok(!!desc && desc[1].length > 20 && desc[1].length <= 160, `${p} meta description 20-160 chars`);
  ok(/<link rel="canonical" href="[^"]+"/.test(text), `${p} has canonical`);
  ok(/<html[^>]*lang="en-IN"/.test(text), `${p} lang en-IN`);
  ok(/property="og:title"/.test(text) && /property="og:image"/.test(text), `${p} has og:title + og:image`);
  for (const m of text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { JSON.parse(m[1]); ok(true, `${p} JSON-LD parses`); } catch { ok(false, `${p} JSON-LD parses`); }
  }
}

const prod = (await get('/products/crochet-lily-bouquet-p1')).text;
ok(prod.includes('"@type":"Product"') && prod.includes('"priceCurrency":"INR"'), 'product page has Product+Offer JSON-LD');
const ws = (await get('/workshops/beginner-crochet-make-your-first-flower-w1')).text;
ok(ws.includes('"@type":"Event"') && ws.includes('+05:30'), 'workshop page has Event JSON-LD');

for (const p of ['/products/anything-p1', '/products/nope', '/workshops/x-w1', '/cities/delhi', '/zzz'])
  ok((await get(p)).status === 404, `${p} → 404`);

const f = (await get('/shop?city=Jaipur&q=blue')).text;
ok(/<meta name="robots" content="noindex, follow"/.test(f), 'filtered /shop is noindex,follow');
ok(/<link rel="canonical" href="[^"]*\/shop"/.test(f), 'filtered /shop canonical is /shop');
ok((await get('/shop?q=' + 'x'.repeat(10000))).status === 200, 'huge q does not crash');

const sm = await get('/sitemap.xml');
ok(sm.status === 200 && sm.text.includes('/products/crochet-lily-bouquet-p1') && sm.text.includes('/cities/udaipur'), 'sitemap lists products + cities');
ok(!sm.text.includes('/api/') && !sm.text.includes('?'), 'sitemap has no api or query urls');
const rb = await get('/robots.txt');
ok(rb.text.includes('Disallow: /api/') && rb.text.includes('Sitemap:'), 'robots.txt blocks /api and lists sitemap');
ok((await get('/manifest.webmanifest')).status === 200, 'manifest served');
ok((await get('/opengraph-image')).type.includes('image/png'), 'site OG image is png');
ok((await get('/api/health')).status === 200, 'api health still works');

console.log(failed ? `\n${failed} check(s) failed` : '\nAll SEO checks passed');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run full verification**

```bash
npx vitest run                         # all unit tests pass
npx tsc --noEmit                       # no type errors
NEXT_PUBLIC_SITE_URL=http://localhost:3100 npx next build
NEXT_PUBLIC_SITE_URL=http://localhost:3100 npx next start -p 3100 &
sleep 3 && npm run seo:check           # All SEO checks passed
```
Expected: every line `PASS`. Fix any `FAIL` before continuing (common cause: `og:image` missing on pages without an `opengraph-image` file — the root `src/app/opengraph-image.tsx` is inherited by all routes, so it should be present everywhere).

Also e2e the interactive flow manually in `npx next dev`: add product to bag → bag count updates → place demo order → toast shows → `data/db.json` stock decreased and `orders` has 1 entry → reload page shows reduced stock. Reserve a free workshop → seats left decrements. Then restore `data/db.json` from `tests/fixtures/db.json`.

- [ ] **Step 4: Update README, remove legacy**

Rewrite `README.md` "Run it" section:
```md
## Run it
Requirements: Node.js 18.18+ (see Next.js docs for the installed version).

    npm install
    cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL to your real origin in production
    npm run dev                  # http://localhost:3000
    npm run build && npm start   # production
    npm test                     # unit tests
    npm run seo:check            # with a server running on :3100 (BASE_URL to override)

## SEO
Server-rendered pages; per-page metadata + canonical; JSON-LD (Organization, WebSite+SearchAction, Product+Offer, Event, BreadcrumbList); `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`; dynamic OG images; filtered views are `noindex,follow` with canonical to the base list page; unknown slugs return real 404s.

## Deploy note
Orders/bookings write `data/db.json`, so deploy on a host with a persistent writable disk (single Node process). Serverless/read-only filesystems need the PostgreSQL step below first.
```
Keep the existing "limitations", "API endpoints", and "Suggested next build" sections (adjust step (1) to "PostgreSQL/Prisma + NestJS or Next route handlers").
Then:
```bash
git rm -r --quiet legacy 2>/dev/null || rm -rf legacy
git add -A && git commit -m "feat: sitemap, robots, manifest, SEO check script; drop legacy server"
```

- [ ] **Step 5: Final** — `npx next build` once more from clean (`rm -rf .next`), confirm success; kill background server.

---

## Self-Review

**Spec coverage:** Next.js conversion → Tasks 1,7–10. API parity → Task 5. SEO: metadata/canonical (6,9,10), JSON-LD (6,10), sitemap/robots/manifest (11), OG images (10), semantic HTML/h1/skip-link/lang (7,9), crawlable filters + noindex (9), 404 correctness (10), city landing pages for local SEO (10), fonts via `next/font` for CLS/LCP (7), SSR content (9), security headers + `noindex` on API (1,5). README baseline preserved (Task 11).

**Placeholders:** Two components are specified by mirror instruction rather than full code — `Hero.tsx` (verbatim port of existing markup from `legacy/index.html`, mechanical) and the workshop detail page / `/workshops` list page (mirror of fully-shown product/shop pages with every differing string given). The legacy file is deleted only at the end of Task 11, so the source is available.

**Type consistency:** `productSlug`/`workshopSlug`/`citySlug`/`cityFromSlug` (Task 4) used identically in 6, 9, 10, 11. `Filters` type from `filters.ts` used by `FilterForm`. `useStore` fields match component usage (`openBooking`, `closeBooking`, `setCartOpen`, `checkout`, `reserve`, `notify`). JSON-LD image path `/…/opengraph-image` matches the Task 10 file-convention route.

**Review Focus coverage:** (1) Task 4 slug tests + Task 10/11 404 checks; (2) Task 4 filters tests + Task 9/11 curl/seo-check; (3) Task 3/5 concurrency tests; (4) Task 6 escape test; (5) Task 6 availability tests + Task 8 disabled buttons.

**Known risks to flag at execution:** exact Next major version may change API details (`params` Promise, `next/og`, Metadata types) — run `npx tsc --noEmit` after each task; if the installed version prints deprecation warnings (e.g. `middleware`→`proxy` renames), none are used here.

---

### Task 12 (added mid-run by user request): API authentication and authorization

**Decisions (user-confirmed):** Google sign-in via NextAuth stable v4 (`next-auth@4.24.x`, user: "stable version only"; v5 is beta-only); roles `customer` + `admin`; `GET /api/health|products|workshops` public; `POST/GET /api/orders` and `/api/bookings` require login; `/api/admin/summary` requires admin.

**Design rulings:** admins = emails in `ADMIN_EMAILS` (comma-separated, case-insensitive), everyone else signing in is `customer`; only Google accounts with `email_verified` may sign in; JWT sessions; session read client-side (`SessionProvider`) so pages stay statically renderable for SEO; order/booking owner = session email (never the request body); `GET /api/orders|bookings` return own records, admin sees all; wildcard CORS dropped (credentialed same-origin API); mutating routes rely on Auth.js SameSite=Lax cookies for CSRF.

**Files:** `src/auth.ts`, `src/lib/authz.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/components/AuthProvider.tsx`, `src/components/AuthButton.tsx`; modify orders/bookings/summary routes, `orders.ts`, `types.ts`, `CartDialog`, `BookingDialog`, `Header`, layout, `.env.example`, README; tests `tests/authz.test.ts`, updated `tests/api.test.ts`, `tests/orders.test.ts`.

**Interfaces:** `roleFor(email, adminEmailsEnv?) : 'customer'|'admin'`; `requireUser(session) : {email; role; name?}` (throws `ApiError(401,'Authentication required.')`); `requireAdmin(session)` (401 unauthenticated, `ApiError(403,'Admin access required.')` for customers); `createOrder(input, userEmail)`, `createBooking(input, userEmail)`, `listOrders(user)`, `listBookings(user)`.
