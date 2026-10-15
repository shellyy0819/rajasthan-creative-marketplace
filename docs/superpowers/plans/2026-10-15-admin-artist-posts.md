# Admin View for Artists' Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a separate, access-controlled view at `/admin/posts` to read, create, edit and delete each artist's posts (product listings), with draft/published control, while published posts stay public and drafts stay private.

**Architecture:** A "post" is an existing `Product`; an "artist" is the product's `seller` name (grouped case-insensitively, no new table). Writes reuse the existing admin-only `POST/PATCH/DELETE /api/products` APIs; three new admin-only read endpoints expose drafts and artist groupings. The `/admin` route tree is server-gated (anonymous → sign-in redirect, customer → 404) in both layout and page, and the UI is one client component (`PostsAdmin`) with an artist sidebar, filters, list, a create/edit form and inline delete confirmation. A new optional `imageUrl` (https only) is shown on public cards/pages and in product JSON-LD.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, NextAuth v4 (existing), Vitest + jsdom/Testing Library (existing), plain CSS in `src/app/globals.css`.

**Spec:** No spec doc. Requirements = user message 2026-10-15 "create a separate view where an admin can create, edit, delete, read artist's post" plus user's answers: post = product listing by the artist; artist = seller name (no new artists table); admin manages, **published posts shown publicly**, drafts admin-only; cover image = **image URL field only** (no uploads).

## Pre-flight (do before Task 1)

The working tree has uncommitted work by someone else: seller contact fields (`artistName`, `instagram`, `youtube`, `phone`, `email`) in `src/lib/types.ts`, `src/lib/admin.ts` (+ `PRODUCT_KEYS`), `data/db.json`, `src/app/products/[slug]/page.tsx`, plus a home-page craft-explorer prototype (`src/components/HomeCraftExplorer.tsx`, `src/app/page.tsx`, `.craft-*`/`.product-card` CSS). This plan edits `types.ts`, `admin.ts`, `data/db.json` consumers and `products/[slug]/page.tsx`.

- [ ] **Step 1:** Have that work committed first (suggested: `git add -A && git commit -m "wip: seller contact fields + craft explorer prototype"`). Do not discard it.
- [ ] **Step 2:** `export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH && npx vitest run && npx tsc --noEmit` — Expected: all pass before starting.
- [ ] **Step 3:** Note: `docs/superpowers/plans/2026-10-15-home-craft-explorer.md` (not yet executed) adds `material`/`collections` fields. If it lands later, add those two fields to the form in Task 5; nothing here depends on it.

## Global Constraints

- Admin = session `role: 'admin'` (emails in `ADMIN_EMAILS`); every admin endpoint uses `requireAdmin(await auth())` → 401 anonymous, 403 customer; `/admin/*` pages: anonymous → redirect to `/api/auth/signin?callbackUrl=%2Fadmin%2Fposts`, customer → `notFound()` (404).
- Admin responses must send `Cache-Control: no-store`.
- Public surfaces (`GET /api/products`, `/shop`, `/`, product pages, sitemap, cities) must never expose `status !== 'APPROVED'` products — already enforced by `listProducts`; tests must keep proving it.
- `imageUrl`: https only, ≤ 500 characters, normalised via `new URL().toString()`; rendered with `referrerPolicy="no-referrer"`, `loading="lazy"`, alt text = product name, with the existing emoji visual as fallback on error/absence.
- No new runtime dependencies; no file uploads; no new database table; no native `<dialog>` in the admin UI (jsdom lacks `showModal`) — use an overlay `div role="dialog" aria-modal="true"`.
- Statuses are exactly `'APPROVED'` (shown as "Published") and `'DRAFT'`.
- Admin pages are `noindex,nofollow`, listed in `robots.txt` as `Disallow: /admin/`, never in the sitemap.
- Visual style: reuse palette vars (`--paper #f8f4ee`, `--cream #eee5d8`, `--green #405746`, `--orange #c66b43`, `--line #e5ddd1`, `--white #fffdf9`) and fonts `var(--font-serif)` / `var(--font-sans)`.
- Commits use the repo identity (`shellyy0819`) and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Access control leaks:** anonymous/customer hitting `/admin/posts` or the three admin read APIs must get nothing (no draft names in HTML/JSON, no flash of content); drafts never appear in public API, `/shop`, sitemap, or at their product URL. (Tasks 2, 3, 6)
2. **`imageUrl` abuse:** `javascript:`, `data:`, `http:`, relative, 501-char or non-string values are rejected with 400; a valid-looking URL that fails to load falls back to the emoji visual instead of a broken image. (Tasks 1, 4)
3. **Artist identity drift:** `"Shauk and Stuff"`, `" shauk  and stuff "`, `"SHAUK AND STUFF"` are one artist; editing a post's artist name moves it to another group; deleting an artist's last post makes the artist disappear (no orphan). (Task 2, Task 5)
4. **Destructive/stale actions:** delete needs an explicit confirm; double-clicking Save sends one request; editing or deleting a post someone else already deleted shows the API's 404 message and refreshes, no crash. (Task 5)
5. **Form input edge cases:** price typed as `19.99` becomes exactly 1999 paise; negative/blank/NaN price or stock, empty name, and over-long fields show the server's field-named error and keep the user's typing. (Task 5)

---

## File Structure

- Create `src/lib/artist.ts` — `artistKey(name)` (client-safe).
- Create `src/lib/admin-posts.ts` — `listProductsForAdmin`, `getProductForAdmin`, `listArtists` (+ types).
- Create `src/lib/admin-gate.ts` — pure `adminGate(session)`; `src/lib/admin-page.ts` — `requireAdminPage()` for server components.
- Create API routes `src/app/api/admin/{artists,products}/route.ts`, `src/app/api/admin/products/[id]/route.ts`.
- Create `src/app/admin/{layout,page}.tsx`, `src/app/admin/posts/page.tsx`.
- Create `src/components/{ProductImage,PostsAdmin,PostForm}.tsx`; modify `ProductCard.tsx`, `AuthButton.tsx`, `src/app/products/[slug]/page.tsx`.
- Modify `src/lib/{types,admin,api,jsonld}.ts`, `src/app/robots.ts`, `src/app/globals.css`, `scripts/seo-check.mjs`, `README.md`.
- Tests: `tests/admin.test.ts` (extend), `tests/admin-posts.test.ts`, `tests/admin-posts-api.test.ts`, `tests/admin-gate.test.ts`, `tests/product-image.test.tsx`, `tests/post-form.test.ts`, `tests/posts-admin.test.tsx`, `tests/jsonld.test.ts` (extend).

---

### Task 1: `imageUrl` field and create-as-draft

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/admin.ts` (PRODUCT_KEYS, `validateProduct`, `createProduct`)
- Test: `tests/admin.test.ts` (extend + adjust one existing test)

**Interfaces:**
- Produces: `Product.imageUrl?: string`; `createProduct(input)` now honours `status` of `'APPROVED'|'DRAFT'` (default `'APPROVED'`; any other value → `ApiError 400`); `imageUrl` validated/normalised in create and update; `''`/`null` clears it.

- [ ] **Step 1: Failing tests.** In `tests/admin.test.ts` replace the existing test `ignores client-supplied id/status mass assignment on create` with:

```ts
  it('ignores a client-supplied id on create (valid status is honoured)', async () => {
    const p = await createProduct({ ...validProduct, id: 'p1', status: 'DRAFT' });
    expect(p.id).toBe('p5');
    expect(p.status).toBe('DRAFT');
  });
  it('rejects an unknown status on create', async () => {
    await expect(createProduct({ ...validProduct, status: 'HACK' })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('status') });
    expect((await readDb()).products).toHaveLength(4);
  });
```
and append:
```ts
describe('product imageUrl', () => {
  it('accepts https URLs and normalises them', async () => {
    const p = await createProduct({ ...validProduct, imageUrl: 'https://cdn.example.com/a b.jpg' });
    expect(p.imageUrl).toBe('https://cdn.example.com/a%20b.jpg');
  });
  it('rejects non-https, scripts, data URLs, junk, non-strings and >500 chars', async () => {
    for (const imageUrl of [
      'http://cdn.example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//cdn.example.com/a.jpg',
      '/relative.jpg', 'not a url', 42, 'https://x.example.com/' + 'a'.repeat(500),
    ]) {
      await expect(createProduct({ ...validProduct, imageUrl })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('imageUrl') });
    }
    expect((await readDb()).products).toHaveLength(4);
  });
  it('can be cleared with an empty string on update', async () => {
    await updateProduct('p1', { imageUrl: 'https://cdn.example.com/a.jpg' });
    expect((await readDb()).products[0].imageUrl).toBe('https://cdn.example.com/a.jpg');
    await updateProduct('p1', { imageUrl: '' });
    expect((await readDb()).products[0].imageUrl).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/admin.test.ts` — Expected: FAIL (imageUrl ignored; `HACK` still coerced to APPROVED).

- [ ] **Step 3: Implement.**
`src/lib/types.ts`: add `imageUrl?: string;` to `Product` (same line as the seller contact fields).

`src/lib/admin.ts`: add `'imageUrl'` to `PRODUCT_KEYS`; add above `validateProduct`:
```ts
function optionalImageUrl(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const msg = 'imageUrl must be an https URL up to 500 characters.';
  if (typeof v !== 'string' || v.trim().length > 500) throw bad(msg);
  let u: URL;
  try { u = new URL(v.trim()); } catch { throw bad(msg); }
  if (u.protocol !== 'https:') throw bad(msg);
  return u.toString();
}
```
add `imageUrl: optionalImageUrl(v.imageUrl),` to the object returned by `validateProduct`; and in `createProduct` change
`const data = validateProduct({ ...pick(obj(input), PRODUCT_KEYS), status: undefined });` to
`const data = validateProduct(pick(obj(input), PRODUCT_KEYS));` (`validateProduct` already defaults `status` to `'APPROVED'` and rejects values outside `STATUSES`). Leave `createWorkshop` untouched.

- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.

- [ ] **Step 5: Commit**
```bash
git add src/lib/types.ts src/lib/admin.ts tests/admin.test.ts
git commit -m "feat: product imageUrl (https only) and create-as-draft"
```

---

### Task 2: Admin read layer — artists, all-status listing, single read

**Files:**
- Create: `src/lib/artist.ts`, `src/lib/admin-posts.ts`, `src/app/api/admin/artists/route.ts`, `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[id]/route.ts`
- Modify: `src/lib/api.ts` (`json` gets optional headers)
- Test: `tests/admin-posts.test.ts`, `tests/admin-posts-api.test.ts`

**Interfaces:**
- Consumes: `readDb`, `ApiError`, `requireAdmin`, `auth`, `Product`.
- Produces:
  - `artistKey(name: string): string` — trim, collapse whitespace, lowercase
  - `type AdminArtist = { key: string; name: string; total: number; published: number; drafts: number }`
  - `type AdminProductQuery = { artist?: string; status?: string; q?: string }`
  - `listProductsForAdmin(f?: AdminProductQuery): Promise<Product[]>` — all statuses, newest id first
  - `getProductForAdmin(id: string): Promise<Product>` — `ApiError(404,'Product not found.')`
  - `listArtists(): Promise<AdminArtist[]>` — sorted by name
  - `json(data: unknown, status = 200, headers?: HeadersInit): Response`
  - Endpoints (admin only, `no-store`): `GET /api/admin/artists`, `GET /api/admin/products?artist=&status=APPROVED|DRAFT&q=` (bad `status` → 400), `GET /api/admin/products/:id`.

- [ ] **Step 1: Failing tests.**

`tests/admin-posts.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listProductsForAdmin, getProductForAdmin, listArtists } from '@/lib/admin-posts';
import { artistKey } from '@/lib/artist';
import { createProduct, deleteProduct, updateProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrap-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});
const base = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, seller: 'Marwar Lac', description: 'Hand-set.', stock: 3 };

describe('artistKey', () => {
  it('treats case and spacing variants as one artist', () => {
    expect(artistKey('Shauk and Stuff')).toBe(artistKey('  SHAUK   and  stuff '));
  });
});

describe('listProductsForAdmin', () => {
  it('includes drafts that the public listing hides, newest first', async () => {
    await createProduct({ ...base, status: 'DRAFT' });
    const admin = await listProductsForAdmin();
    expect(admin.map(p => p.id)).toEqual(['p5', 'p4', 'p3', 'p2', 'p1']);
    expect((await listProducts()).map(p => p.id)).not.toContain('p5');
  });
  it('filters by artist (case/space-insensitive), status and text', async () => {
    await createProduct({ ...base, status: 'DRAFT' });
    expect((await listProductsForAdmin({ artist: '  shauk AND stuff' })).map(p => p.id)).toEqual(['p1']);
    expect((await listProductsForAdmin({ status: 'DRAFT' })).map(p => p.id)).toEqual(['p5']);
    expect((await listProductsForAdmin({ q: 'BLUE' })).map(p => p.id)).toEqual(['p4']);
  });
});

describe('getProductForAdmin', () => {
  it('returns a draft; 404 for a missing id', async () => {
    const d = await createProduct({ ...base, status: 'DRAFT' });
    expect((await getProductForAdmin(d.id)).status).toBe('DRAFT');
    await expect(getProductForAdmin('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('listArtists', () => {
  it('groups by seller case-insensitively with published/draft counts, sorted by name', async () => {
    await createProduct({ ...base, seller: 'shauk and stuff', status: 'DRAFT' });
    const artists = await listArtists();
    const shauk = artists.find(a => a.key === 'shauk and stuff')!;
    expect(shauk).toMatchObject({ name: 'Shauk and Stuff', total: 2, published: 1, drafts: 1 });
    expect(artists.map(a => a.name)).toEqual([...artists.map(a => a.name)].sort((a, b) => a.localeCompare(b)));
  });
  it('an artist disappears when their last post is deleted; renaming moves a post', async () => {
    await deleteProduct('p2');
    expect((await listArtists()).some(a => a.name === 'Lake City Knots')).toBe(false);
    await updateProduct('p1', { seller: 'New Studio' });
    const names = (await listArtists()).map(a => a.name);
    expect(names).toContain('New Studio');
    expect(names).not.toContain('Shauk and Stuff');
  });
});
```

`tests/admin-posts-api.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { GET as artistsRoute } from '@/app/api/admin/artists/route';
import { GET as listRoute } from '@/app/api/admin/products/route';
import { GET as oneRoute } from '@/app/api/admin/products/[id]/route';
import { GET as publicProducts } from '@/app/api/products/route';
import { createProduct } from '@/lib/admin';

const asCustomer = () => authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const req = (qs = '') => new Request(`http://x/api/admin/products${qs}`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const calls = () => [() => artistsRoute(), () => listRoute(req()), () => oneRoute(req(), ctx('p1'))];

beforeEach(async () => {
  authMock.mockReset();
  authMock.mockResolvedValue(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrapa-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
  await createProduct({ name: 'Secret Draft', category: 'Accessories', city: 'Jodhpur', pricePaise: 100, seller: 'Marwar Lac', description: 'Hidden.', stock: 1, status: 'DRAFT' });
});

describe('admin read APIs', () => {
  it('401 anonymous, 403 customer — and the body never mentions drafts', async () => {
    for (const c of calls()) {
      const r = await c(); expect(r.status).toBe(401);
      expect(JSON.stringify(await r.json())).not.toContain('Secret Draft');
    }
    asCustomer();
    for (const c of calls()) {
      const r = await c(); expect(r.status).toBe(403);
      expect(JSON.stringify(await r.json())).not.toContain('Secret Draft');
    }
  });
  it('admin sees drafts, no-store header, artist groups', async () => {
    asAdmin();
    const list = await listRoute(req());
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect((await list.json()).map((p: { name: string }) => p.name)).toContain('Secret Draft');
    const artists = await (await artistsRoute()).json();
    expect(artists.find((a: { key: string }) => a.key === 'marwar lac')).toMatchObject({ total: 1, drafts: 1, published: 0 });
  });
  it('status/artist filters, 400 on bad status, 404 on unknown id', async () => {
    asAdmin();
    expect((await (await listRoute(req('?status=DRAFT'))).json())).toHaveLength(1);
    expect((await (await listRoute(req('?artist=MARWAR%20LAC'))).json())).toHaveLength(1);
    expect((await listRoute(req('?status=WHATEVER'))).status).toBe(400);
    expect((await oneRoute(req(), ctx('nope'))).status).toBe(404);
    expect((await oneRoute(req(), ctx('p5'))).status).toBe(200);
  });
  it('public API never returns drafts', async () => {
    const names = (await (await publicProducts(new Request('http://x/api/products'))).json()).map((p: { name: string }) => p.name);
    expect(names).not.toContain('Secret Draft');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/admin-posts.test.ts tests/admin-posts-api.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement.**

`src/lib/artist.ts`:
```ts
export const artistKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
```
`src/lib/admin-posts.ts`:
```ts
import { artistKey } from './artist';
import { readDb } from './db';
import { ApiError } from './errors';
import type { Product } from './types';

export { artistKey };
export type AdminArtist = { key: string; name: string; total: number; published: number; drafts: number };
export type AdminProductQuery = { artist?: string; status?: string; q?: string };

const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

export async function listProductsForAdmin(f: AdminProductQuery = {}): Promise<Product[]> {
  const q = (f.q ?? '').trim().toLowerCase();
  const { products } = await readDb();
  return products
    .filter(p =>
      (!f.artist || artistKey(p.seller) === artistKey(f.artist)) &&
      (!f.status || p.status === f.status) &&
      (!q || `${p.name} ${p.description} ${p.seller} ${p.category}`.toLowerCase().includes(q)))
    .sort((a, b) => idNum(b.id) - idNum(a.id));
}

export async function getProductForAdmin(id: string): Promise<Product> {
  const p = (await readDb()).products.find(x => x.id === id);
  if (!p) throw new ApiError(404, 'Product not found.');
  return p;
}

export async function listArtists(): Promise<AdminArtist[]> {
  const { products } = await readDb();
  const groups = new Map<string, AdminArtist>();
  for (const p of products) {
    const key = artistKey(p.seller);
    const a = groups.get(key) ?? { key, name: p.seller.trim().replace(/\s+/g, ' '), total: 0, published: 0, drafts: 0 };
    a.total++;
    if (p.status === 'APPROVED') a.published++; else a.drafts++;
    groups.set(key, a);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
```
`src/lib/api.ts`: change `json` to
```ts
export const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });
```
Routes (all `export const dynamic = 'force-dynamic';`, `const NO_STORE = { 'cache-control': 'no-store' };`):
```ts
// src/app/api/admin/artists/route.ts
import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { listArtists } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listArtists(), 200, { 'cache-control': 'no-store' });
});
```
```ts
// src/app/api/admin/products/route.ts
import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { ApiError } from '@/lib/errors';
import { listProductsForAdmin } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => handle(async () => {
  requireAdmin(await auth());
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') ?? undefined;
  if (status && status !== 'APPROVED' && status !== 'DRAFT') throw new ApiError(400, 'status must be APPROVED or DRAFT.');
  return json(await listProductsForAdmin({ artist: sp.get('artist') ?? undefined, status, q: sp.get('q') ?? undefined }), 200, { 'cache-control': 'no-store' });
});
```
```ts
// src/app/api/admin/products/[id]/route.ts
import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { getProductForAdmin } from '@/lib/admin-posts';
export const dynamic = 'force-dynamic';
export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) => handle(async () => {
  requireAdmin(await auth());
  return json(await getProductForAdmin((await params).id), 200, { 'cache-control': 'no-store' });
});
```

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — Expected: all pass, clean.

- [ ] **Step 5: Commit**
```bash
git add src/lib/artist.ts src/lib/admin-posts.ts src/lib/api.ts src/app/api/admin tests/admin-posts.test.ts tests/admin-posts-api.test.ts
git commit -m "feat: admin read APIs for artists and all-status products"
```

---

### Task 3: Admin route gate, robots, header link

**Files:**
- Create: `src/lib/admin-gate.ts`, `src/lib/admin-page.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- Modify: `src/app/robots.ts`, `src/components/AuthButton.tsx`
- Test: `tests/admin-gate.test.ts`

**Interfaces:**
- Consumes: `AppSession` (`src/lib/authz.ts`), `auth`.
- Produces: `type Gate = 'ok'|'signin'|'forbidden'`; `adminGate(session: AppSession): Gate`; `requireAdminPage(): Promise<void>` (server-only: redirects/404s); `robots()` disallows `/admin/`; `AuthButton` renders an `Admin` link to `/admin/posts` for admins.

- [ ] **Step 1: Failing tests** `tests/admin-gate.test.ts`:
```ts
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { adminGate } from '@/lib/admin-gate';
import robots from '@/app/robots';

const session = vi.hoisted(() => ({ value: { data: null as any, status: 'unauthenticated' } }));
vi.mock('next-auth/react', () => ({ useSession: () => session.value, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { AuthButton } from '@/components/AuthButton';

afterEach(cleanup);

describe('adminGate', () => {
  it('signin for anonymous or email-less sessions', () => {
    expect(adminGate(null)).toBe('signin');
    expect(adminGate({ user: {} })).toBe('signin');
  });
  it('forbidden for customers and role-less users; ok for admins', () => {
    expect(adminGate({ user: { email: 'c@x.co', role: 'customer' } })).toBe('forbidden');
    expect(adminGate({ user: { email: 'c@x.co' } })).toBe('forbidden');
    expect(adminGate({ user: { email: 'a@x.co', role: 'admin' } })).toBe('ok');
  });
});

describe('robots', () => {
  it('disallows /admin/ and /api/', () => {
    const rules = robots().rules as { disallow: string[] };
    expect(rules.disallow).toEqual(expect.arrayContaining(['/api/', '/admin/']));
  });
});

describe('AuthButton admin link', () => {
  it('shows an Admin link only for admins', () => {
    session.value = { data: { user: { email: 'a@x.co', role: 'admin' } }, status: 'authenticated' };
    const { unmount } = render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin/posts');
    unmount();
    session.value = { data: { user: { email: 'c@x.co', role: 'customer' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });
});
```
- [ ] **Step 2: Run** `npx vitest run tests/admin-gate.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement.**
`src/lib/admin-gate.ts`:
```ts
import type { AppSession } from './authz';

export type Gate = 'ok' | 'signin' | 'forbidden';

export function adminGate(session: AppSession): Gate {
  if (!session?.user?.email) return 'signin';
  return session.user.role === 'admin' ? 'ok' : 'forbidden';
}
```
`src/lib/admin-page.ts`:
```ts
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { adminGate } from './admin-gate';

// Call from BOTH the admin layout and every admin page: layouts and pages render independently,
// so a page must never rely on the layout alone for access control.
export async function requireAdminPage(): Promise<void> {
  const gate = adminGate(await auth());
  if (gate === 'signin') redirect('/api/auth/signin?callbackUrl=%2Fadmin%2Fposts');
  if (gate === 'forbidden') notFound();
}
```
`src/app/admin/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-page';

export const metadata: Metadata = { title: { absolute: 'Admin | Rang Rajasthan' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="admin-shell">
      <nav className="crumbs" aria-label="Admin"><Link href="/admin/posts">Artists’ posts</Link></nav>
      {children}
    </div>
  );
}
```
`src/app/admin/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-page';
export const dynamic = 'force-dynamic';
export default async function AdminIndex() { await requireAdminPage(); redirect('/admin/posts'); }
```
`src/app/robots.ts`: `disallow: ['/api/', '/admin/']`.
`src/components/AuthButton.tsx`: import `Link from 'next/link'`; wrap the signed-in return in a fragment: `<>{session.user.role === 'admin' && <Link href="/admin/posts">Admin</Link>}<button …existing Sign out button…/></>`.

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — Expected: pass.

- [ ] **Step 5: Commit**
```bash
git add src/lib/admin-gate.ts src/lib/admin-page.ts src/app/admin src/app/robots.ts src/components/AuthButton.tsx tests/admin-gate.test.ts
git commit -m "feat: admin route gate, robots disallow, admin header link"
```

---

### Task 4: Show `imageUrl` publicly (with fallback) and in JSON-LD

**Files:**
- Create: `src/components/ProductImage.tsx`
- Modify: `src/components/ProductCard.tsx`, `src/app/products/[slug]/page.tsx`, `src/lib/jsonld.ts`, `src/app/globals.css`
- Test: `tests/product-image.test.tsx`, `tests/jsonld.test.ts` (extend)

**Interfaces:**
- Produces: `<ProductImage src?: string alt: string fallback: ReactNode />` (client); `productJsonLd(p)` puts `p.imageUrl` first in `image` when present.

- [ ] **Step 1: Failing tests.**
`tests/product-image.test.tsx`:
```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProductImage } from '@/components/ProductImage';

afterEach(cleanup);
const fb = <span data-testid="fallback">emoji</span>;

describe('ProductImage', () => {
  it('renders a safe lazy image with alt text', () => {
    render(<ProductImage src="https://cdn.example.com/a.jpg" alt="Lac Bangle" fallback={fb} />);
    const img = screen.getByRole('img', { name: 'Lac Bangle' });
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(screen.queryByTestId('fallback')).toBeNull();
  });
  it('shows the fallback when there is no url', () => {
    render(<ProductImage alt="x" fallback={fb} />);
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('falls back when the image fails to load', () => {
    render(<ProductImage src="https://cdn.example.com/broken.jpg" alt="x" fallback={fb} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
```
Append to `tests/jsonld.test.ts` (inside the file, using its existing `product` fixture):
```ts
describe('productJsonLd imageUrl', () => {
  it('lists the admin-provided image first, then the generated OG image', () => {
    const j = productJsonLd({ ...product, imageUrl: 'https://cdn.example.com/a.jpg' }) as any;
    expect(j.image[0]).toBe('https://cdn.example.com/a.jpg');
    expect(j.image[1]).toBe('https://rr.test/products/crochet-lily-bouquet-p1/opengraph-image');
  });
});
```
- [ ] **Step 2: Run** `npx vitest run tests/product-image.test.tsx tests/jsonld.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.**
`src/components/ProductImage.tsx`:
```tsx
'use client';
import { useState } from 'react';

export function ProductImage({ src, alt, fallback }: { src?: string; alt: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  // Plain <img>: admin-supplied URLs can be on any host, so next/image remotePatterns can't be known up front.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="product-photo" src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
```
`ProductCard.tsx`: import `ProductImage` and replace the visual line with
```tsx
<div className={`product-visual visual-${i % 4}`}><ProductImage src={p.imageUrl} alt={p.name} fallback={<span className="symbol" aria-hidden="true">{SYMBOLS[i % SYMBOLS.length]}</span>} /></div>
```
`src/app/products/[slug]/page.tsx` (line ~47, the `detail-art` div): same replacement with `className={`product-visual detail-art visual-${i % 4}`}`.
`src/lib/jsonld.ts` in `productJsonLd`: `image: [...(p.imageUrl ? [p.imageUrl] : []), abs(`${path}/opengraph-image`)],`.
`globals.css` append: `.product-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}`.

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — Expected: pass. The existing `live-catalog` test mocks only `AddToCartButton`; it must still pass (ProductImage has no required context).

- [ ] **Step 5: Commit**
```bash
git add src/components/ProductImage.tsx src/components/ProductCard.tsx "src/app/products/[slug]/page.tsx" src/lib/jsonld.ts src/app/globals.css tests/product-image.test.tsx tests/jsonld.test.ts
git commit -m "feat: show admin-provided product images with safe fallback"
```

---

### Task 5: The admin UI — `PostsAdmin` and `PostForm`

**Files:**
- Create: `src/components/PostForm.tsx`, `src/components/PostsAdmin.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/post-form.test.ts`, `tests/posts-admin.test.tsx`

**Interfaces:**
- Consumes: `Product`, `AdminArtist` (type), `artistKey`, `CATEGORIES`, `CITIES`, `productSlug` (`catalog-shared`), `money`, `ProductImage`; write APIs `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`; read APIs `GET /api/admin/products`, `GET /api/admin/artists`.
- Produces:
  - `buildPayload(f: FormData): Record<string, unknown>` (exported from `PostForm.tsx`) — price in rupees → `pricePaise` integer via `Math.round(Number(x) * 100)`; trims all strings
  - `<PostForm initial?: Product artists: AdminArtist[] onSubmit(payload): Promise<string | null> onCancel(): void />` — `onSubmit` returns an error message or `null`
  - `<PostsAdmin initialProducts: Product[] initialArtists: AdminArtist[] />`

- [ ] **Step 1: Failing tests.**

`tests/post-form.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildPayload } from '@/components/PostForm';

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { name: ' Lac Bangle ', seller: 'Marwar Lac', description: 'Hand-set.', category: 'Accessories', city: 'Jodhpur', price: '19.99', stock: '3', status: 'DRAFT', imageUrl: '', artistName: '', instagram: '', youtube: '', phone: '', email: '' };

describe('buildPayload', () => {
  it('converts rupees to exact paise and trims text', () => {
    const p = buildPayload(form(base));
    expect(p.pricePaise).toBe(1999);
    expect(p.name).toBe('Lac Bangle');
    expect(p.stock).toBe(3);
    expect(p.status).toBe('DRAFT');
  });
  it('rounds float noise correctly', () => {
    for (const [rupees, paise] of [['0.1', 10], ['850', 85000], ['1.005', 100], ['0', 0], ['299.5', 29950]] as const)
      expect(buildPayload(form({ ...base, price: rupees })).pricePaise).toBe(paise);
  });
  it('sends NaN-ish prices as null so the server rejects them with a field-named 400', () => {
    expect(JSON.parse(JSON.stringify(buildPayload(form({ ...base, price: '' })))).pricePaise).toBeNull();
    expect(JSON.parse(JSON.stringify(buildPayload(form({ ...base, price: 'abc' })))).pricePaise).toBeNull();
  });
  it('sends empty optional fields as empty strings (so PATCH clears them)', () => {
    const p = buildPayload(form(base));
    expect(p.imageUrl).toBe('');
    expect(p.instagram).toBe('');
  });
});
```

`tests/posts-admin.test.tsx` (jsdom; in-memory fake API):
```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));

import { PostsAdmin } from '@/components/PostsAdmin';
import { artistKey } from '@/lib/artist';
import type { Product } from '@/lib/types';

const mk = (id: string, name: string, seller: string, status = 'APPROVED', extra: Partial<Product> = {}): Product => ({
  id, name, category: 'Accessories', city: 'Jaipur', pricePaise: 85000, seller, description: 'd', stock: 3, status, ...extra,
});
let db: Product[];
let fetchMock: ReturnType<typeof vi.fn>;
let postDelay: Promise<void> | null;

const artistsOf = (list: Product[]) => {
  const m = new Map<string, any>();
  for (const p of list) {
    const key = artistKey(p.seller);
    const a = m.get(key) ?? { key, name: p.seller.trim(), total: 0, published: 0, drafts: 0 };
    a.total++; p.status === 'APPROVED' ? a.published++ : a.drafts++; m.set(key, a);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
};
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  db = [mk('p3', 'Draft Dish', 'Neel Mitti', 'DRAFT'), mk('p2', 'Boat Charm', 'Lake City Knots'), mk('p1', 'Lily Bouquet', 'Shauk and Stuff', 'APPROVED', { imageUrl: 'https://cdn.example.com/l.jpg' })];
  postDelay = null;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/admin/products') return res(200, db);
    if (url === '/api/admin/artists') return res(200, artistsOf(db));
    if (method === 'POST' && url === '/api/products') {
      if (postDelay) await postDelay;
      const body = JSON.parse(String(init!.body));
      if (body.pricePaise == null) return res(400, { error: 'pricePaise must be an integer between 0 and 10000000.' });
      const p = mk('p9', body.name, body.seller, body.status, { pricePaise: body.pricePaise });
      db = [p, ...db]; return res(201, p);
    }
    const m = /^\/api\/products\/(.+)$/.exec(url);
    if (m && method === 'PATCH') {
      const i = db.findIndex(p => p.id === m[1]);
      if (i < 0) return res(404, { error: 'Product not found.' });
      db[i] = { ...db[i], ...JSON.parse(String(init!.body)) }; return res(200, db[i]);
    }
    if (m && method === 'DELETE') {
      if (!db.some(p => p.id === m[1])) return res(404, { error: 'Product not found.' });
      db = db.filter(p => p.id !== m[1]); return res(200, { ok: true });
    }
    return res(500, { error: 'unexpected ' + method + ' ' + url });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = () => render(<PostsAdmin initialProducts={[...db]} initialArtists={artistsOf(db)} />);
const rows = () => screen.queryAllByTestId('post-row');
const rowFor = (name: string) => rows().find(r => within(r).queryByText(name))!;
const flush = () => waitFor(() => expect(true).toBe(true));
const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('PostsAdmin read', () => {
  it('lists every post including drafts, with status badges and an artist sidebar with counts', () => {
    mount();
    expect(rows()).toHaveLength(3);
    expect(within(rowFor('Draft Dish')).getByText('Draft')).toBeTruthy();
    expect(within(rowFor('Boat Charm')).getByText('Published')).toBeTruthy();
    const side = screen.getByRole('navigation', { name: 'Artists' });
    expect(within(side).getByRole('button', { name: /All artists/ }).textContent).toMatch(/3/);
    expect(within(side).getByRole('button', { name: /Neel Mitti/ }).textContent).toMatch(/1 draft/);
  });
  it('filters by artist, status and search without refetching', () => {
    mount();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Artists' })).getByRole('button', { name: /Lake City Knots/ }));
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /All artists/ }));
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'DRAFT' } });
    expect(rows().map(r => within(r).queryByText('Draft Dish') ? 'd' : 'x')).toEqual(['d']);
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'lily' } });
    expect(rows()).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('published posts link to their public page; drafts say they are not public', () => {
    mount();
    expect(within(rowFor('Lily Bouquet')).getByRole('link', { name: /View public page/ }).getAttribute('href')).toBe('/products/lily-bouquet-p1');
    expect(within(rowFor('Draft Dish')).queryByRole('link', { name: /View public page/ })).toBeNull();
    expect(within(rowFor('Draft Dish')).getByText(/not public/i)).toBeTruthy();
  });
  it('shows an image thumbnail when imageUrl is set', () => {
    mount();
    expect(within(rowFor('Lily Bouquet')).getByRole('img').getAttribute('src')).toBe('https://cdn.example.com/l.jpg');
  });
  it('empty state', () => {
    render(<PostsAdmin initialProducts={[]} initialArtists={[]} />);
    expect(screen.getByText(/No posts yet/)).toBeTruthy();
  });
});

describe('PostsAdmin create', () => {
  const open = () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'New post' })); };
  it('creates a draft: sends rupees as paise, closes, refetches and shows the new row', async () => {
    open();
    fill(/^Title/, 'Lac Bangle'); fill(/^Artist/, 'Marwar Lac'); fill(/^Description/, 'Hand-set.');
    fill(/^Price/, '19.99'); fill(/^Stock/, '3'); fill(/^Status/, 'DRAFT');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products')!;
    expect(JSON.parse(call[1].body)).toMatchObject({ name: 'Lac Bangle', seller: 'Marwar Lac', pricePaise: 1999, stock: 3, status: 'DRAFT' });
    expect(call[1].headers['content-type']).toBe('application/json');
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.getByRole('status').textContent).toMatch(/created/i);
    expect(within(screen.getByRole('navigation', { name: 'Artists' })).getByRole('button', { name: /Marwar Lac/ })).toBeTruthy();
  });
  it('keeps the dialog and the user’s typing when the server rejects the input', async () => {
    open();
    fill(/^Title/, 'Lac Bangle'); fill(/^Artist/, 'Marwar Lac'); fill(/^Description/, 'x'); fill(/^Stock/, '3');
    fireEvent.change(screen.getByLabelText(/^Price/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/pricePaise/));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Lac Bangle');
  });
  it('double-clicking Save sends exactly one request', async () => {
    let release!: () => void; postDelay = new Promise(r => { release = r; });
    open();
    fill(/^Title/, 'Lac Bangle'); fill(/^Artist/, 'Marwar Lac'); fill(/^Description/, 'x'); fill(/^Price/, '10'); fill(/^Stock/, '1');
    const save = screen.getByRole('button', { name: 'Save post' });
    fireEvent.click(save); fireEvent.click(save);
    expect((screen.getByRole('button', { name: /Saving/ }) as HTMLButtonElement).disabled).toBe(true);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fetchMock.mock.calls.filter(c => c[0] === '/api/products' && c[1]?.method === 'POST')).toHaveLength(1);
  });
  it('Escape and Cancel close the form without saving', () => {
    open();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PostsAdmin edit', () => {
  it('prefills the form, PATCHes the post and shows the new values', async () => {
    mount();
    fireEvent.click(within(rowFor('Draft Dish')).getByRole('button', { name: /Edit/ }));
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Draft Dish');
    expect((screen.getByLabelText(/^Price/) as HTMLInputElement).value).toBe('850');
    fill(/^Title/, 'Published Dish'); fill(/^Status/, 'APPROVED');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products/p3')!;
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body)).toMatchObject({ name: 'Published Dish', status: 'APPROVED' });
    await waitFor(() => expect(within(rowFor('Published Dish')).getByText('Published')).toBeTruthy());
  });
  it('editing a post that was deleted elsewhere shows the 404 message and refreshes the list', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
    db = db.filter(p => p.id !== 'p2');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not found/i));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });
  it('changing the artist name moves the post to another artist group', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
    fill(/^Artist/, 'Shauk and Stuff');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const side = screen.getByRole('navigation', { name: 'Artists' });
    await waitFor(() => expect(within(side).queryByRole('button', { name: /Lake City Knots/ })).toBeNull());
  });
});

describe('PostsAdmin delete', () => {
  it('requires an explicit confirm; Cancel keeps the post', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rows()).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('confirming deletes, refetches, and the artist disappears with their last post', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(fetchMock.mock.calls.some(c => c[0] === '/api/products/p2' && c[1].method === 'DELETE')).toBe(true);
    expect(within(screen.getByRole('navigation', { name: 'Artists' })).queryByRole('button', { name: /Lake City Knots/ })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/deleted/i);
  });
  it('deleting an already-deleted post shows the error and refreshes', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    db = db.filter(p => p.id !== 'p2');
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not found/i));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });
});

describe('PostsAdmin session problems', () => {
  it('explains 401/403 from the API instead of failing silently', async () => {
    mount();
    fetchMock.mockImplementation(() => res(401, { error: 'Authentication required.' }));
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/sign in again/i));
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/post-form.test.ts tests/posts-admin.test.tsx` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement.**

`src/components/PostForm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import type { Product } from '@/lib/types';
import type { AdminArtist } from '@/lib/admin-posts';
import { CATEGORIES, CITIES } from '@/lib/catalog-shared';

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export function buildPayload(f: FormData): Record<string, unknown> {
  return {
    name: text(f, 'name'), seller: text(f, 'seller'), description: text(f, 'description'),
    category: text(f, 'category'), city: text(f, 'city'),
    pricePaise: Math.round(Number(text(f, 'price')) * 100),
    stock: Number(text(f, 'stock')),
    status: text(f, 'status'),
    imageUrl: text(f, 'imageUrl'), artistName: text(f, 'artistName'), instagram: text(f, 'instagram'),
    youtube: text(f, 'youtube'), phone: text(f, 'phone'), email: text(f, 'email'),
  };
}

type Props = {
  initial?: Product;
  artists: AdminArtist[];
  onSubmit: (payload: Record<string, unknown>) => Promise<string | null>;
  onCancel: () => void;
};

export function PostForm({ initial, artists, onSubmit, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const v = (k: keyof Product) => (initial?.[k] as string | number | undefined) ?? '';

  return (
    <div className="admin-modal" onKeyDown={e => { if (e.key === 'Escape' && !saving) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="post-form-title" className="admin-form-card">
        <div className="dialog-head">
          <h2 id="post-form-title">{initial ? 'Edit post' : 'New post'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onCancel} disabled={saving}>✕</button>
        </div>
        <form className="admin-form" onSubmit={async e => {
          e.preventDefault();
          if (saving) return;
          setSaving(true); setError('');
          const message = await onSubmit(buildPayload(new FormData(e.currentTarget)));
          if (message) { setError(message); setSaving(false); }
        }}>
          {error && <p role="alert" className="admin-error">{error}</p>}
          <label>Title<input name="name" required maxLength={200} defaultValue={v('name')} autoFocus /></label>
          <label>Artist (seller name)
            <input name="seller" required maxLength={200} defaultValue={v('seller')} list="artist-names" />
            <datalist id="artist-names">{artists.map(a => <option key={a.key} value={a.name} />)}</datalist>
            <small>Posts with the same artist name are grouped together. Changing it moves this post to another artist.</small>
          </label>
          <label>Description<textarea name="description" required maxLength={2000} rows={4} defaultValue={v('description')} /></label>
          <div className="admin-form-row">
            <label>Category<select name="category" defaultValue={v('category') || CATEGORIES[0]}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label>City<select name="city" defaultValue={v('city') || CITIES[0]}>{CITIES.map(c => <option key={c}>{c}</option>)}</select></label>
          </div>
          <div className="admin-form-row">
            <label>Price (₹)<input name="price" type="number" min="0" step="0.01" required defaultValue={initial ? initial.pricePaise / 100 : ''} /></label>
            <label>Stock<input name="stock" type="number" min="0" step="1" required defaultValue={initial ? initial.stock : ''} /></label>
            <label>Status<select name="status" defaultValue={initial?.status ?? 'APPROVED'}><option value="APPROVED">Published</option><option value="DRAFT">Draft (admin only)</option></select></label>
          </div>
          <label>Cover image URL (https)<input name="imageUrl" type="url" maxLength={500} placeholder="https://…" defaultValue={v('imageUrl')} /></label>
          <fieldset>
            <legend>Artist contact (shown on this post’s page)</legend>
            <div className="admin-form-row">
              <label>Artist display name<input name="artistName" maxLength={200} defaultValue={v('artistName')} /></label>
              <label>Phone<input name="phone" maxLength={40} defaultValue={v('phone')} /></label>
            </div>
            <div className="admin-form-row">
              <label>Instagram<input name="instagram" maxLength={200} defaultValue={v('instagram')} /></label>
              <label>YouTube<input name="youtube" maxLength={200} defaultValue={v('youtube')} /></label>
              <label>Email<input name="email" type="email" maxLength={200} defaultValue={v('email')} /></label>
            </div>
          </fieldset>
          <div className="admin-actions">
            <button type="button" className="button" onClick={onCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save post'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
(Test labels use regex `^Title`, `^Artist`, `^Description`, `^Price`, `^Stock`, `^Status`; the `Artist (seller name)` label must not also match `^Artist display name` ambiguously — `getByLabelText(/^Artist/)` would match both "Artist (seller name)…" and "Artist display name…". Make the contact label read "Display name" instead of "Artist display name".)

`src/components/PostsAdmin.tsx`:
```tsx
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import type { AdminArtist } from '@/lib/admin-posts';
import { artistKey } from '@/lib/artist';
import { productSlug } from '@/lib/catalog-shared';
import { money } from '@/lib/money';
import { ProductImage } from './ProductImage';
import { PostForm } from './PostForm';

const SYMBOLS = ['🌷', '⛵', '🌼', '🏺', '🧶', '🌸'];
const symbolFor = (id: string) => SYMBOLS[(Number(id.replace(/\D/g, '')) || 0) % SYMBOLS.length];
const JSON_HEADERS = { 'content-type': 'application/json' };

function explain(status: number, body: { error?: string } | null): string {
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  return body?.error || 'Something went wrong. Please try again.';
}

export function PostsAdmin({ initialProducts, initialArtists }: { initialProducts: Product[]; initialArtists: AdminArtist[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [artists, setArtists] = useState(initialArtists);
  const [artist, setArtist] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [confirming, setConfirming] = useState<Product | null>(null);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');

  async function refresh() {
    try {
      const [p, a] = await Promise.all([
        fetch('/api/admin/products', { cache: 'no-store' }),
        fetch('/api/admin/artists', { cache: 'no-store' }),
      ]);
      if (!p.ok || !a.ok) { setProblem(explain((p.ok ? a : p).status, await (p.ok ? a : p).json().catch(() => null))); return; }
      setProducts(await p.json());
      setArtists(await a.json());
    } catch { setProblem('Could not refresh the list. Check your connection.'); }
  }

  async function call(url: string, method: string, body?: unknown): Promise<string | null> {
    try {
      const res = await fetch(url, { method, headers: JSON_HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) { await refresh(); return explain(res.status, data); }
      return null;
    } catch { return 'Network error. Please try again.'; }
  }

  const save = async (payload: Record<string, unknown>) => {
    const isNew = editing === 'new';
    const err = await call(isNew ? '/api/products' : `/api/products/${(editing as Product).id}`, isNew ? 'POST' : 'PATCH', payload);
    if (err) return err;
    setEditing(null); setProblem(''); setMessage(isNew ? 'Post created.' : 'Post saved.');
    await refresh();
    return null;
  };

  const remove = async (p: Product) => {
    setConfirming(null);
    const err = await call(`/api/products/${p.id}`, 'DELETE');
    if (err) { setProblem(err); return; }
    setProblem(''); setMessage(`Deleted “${p.name}”.`);
    await refresh();
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(p =>
      (!artist || artistKey(p.seller) === artist) &&
      (!status || p.status === status) &&
      (!needle || `${p.name} ${p.description} ${p.seller}`.toLowerCase().includes(needle)));
  }, [products, artist, status, q]);

  const total = artists.reduce((n, a) => n + a.total, 0);

  return (
    <section className="admin-posts">
      <div className="page-head">
        <span className="eyebrow">ADMIN</span>
        <h1>Artists’ posts</h1>
        <p>Create, edit and remove each artist’s listings. Published posts appear on the site; drafts stay here.</p>
      </div>
      {message && <p role="status" className="admin-flash">{message}</p>}
      {problem && <p role="alert" className="admin-error">{problem}</p>}

      <div className="admin-grid">
        <nav aria-label="Artists" className="admin-artists">
          <button type="button" className={artist ? '' : 'selected'} onClick={() => setArtist('')}>All artists <small>{total}</small></button>
          {artists.map(a => (
            <button key={a.key} type="button" className={artist === a.key ? 'selected' : ''} onClick={() => setArtist(a.key)}>
              {a.name} <small>{a.total}{a.drafts ? ` · ${a.drafts} ${a.drafts === 1 ? 'draft' : 'drafts'}` : ''}</small>
            </button>
          ))}
        </nav>

        <div>
          <div className="admin-toolbar">
            <input aria-label="Search posts" placeholder="Search posts…" value={q} onChange={e => setQ(e.target.value)} />
            <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option><option value="APPROVED">Published</option><option value="DRAFT">Drafts</option>
            </select>
            <button type="button" className="button primary" onClick={() => { setMessage(''); setEditing('new'); }}>New post</button>
          </div>

          {products.length === 0 ? <div className="empty">No posts yet. Create the first one.</div>
            : shown.length === 0 ? <div className="empty">No posts match those filters.</div>
            : shown.map(p => (
              <article key={p.id} className="admin-row" data-testid="post-row">
                <div className="admin-thumb">
                  <ProductImage src={p.imageUrl} alt={p.name} fallback={<span aria-hidden="true">{symbolFor(p.id)}</span>} />
                </div>
                <div className="admin-row-main">
                  <h3>{p.name}</h3>
                  <p>{p.seller} · {p.category} · {p.city} · {money(p.pricePaise)} · {p.stock} in stock</p>
                  <p><span className={`badge ${p.status === 'APPROVED' ? 'published' : 'draft'}`}>{p.status === 'APPROVED' ? 'Published' : 'Draft'}</span>
                    {p.status === 'APPROVED'
                      ? <Link href={`/products/${productSlug(p)}`}>View public page ↗</Link>
                      : <small> Draft — not public</small>}</p>
                </div>
                {confirming?.id === p.id ? (
                  <div className="admin-confirm" role="group" aria-label={`Confirm delete ${p.name}`}>
                    <span>Delete “{p.name}”? This can’t be undone.</span>
                    <button type="button" className="button" onClick={() => setConfirming(null)}>Cancel</button>
                    <button type="button" className="button danger" onClick={() => remove(p)}>Yes, delete</button>
                  </div>
                ) : (
                  <div className="admin-row-actions">
                    <button type="button" className="button" onClick={() => { setMessage(''); setEditing(p); }}>Edit<span className="sr-only"> {p.name}</span></button>
                    <button type="button" className="button danger-outline" onClick={() => setConfirming(p)}>Delete<span className="sr-only"> {p.name}</span></button>
                  </div>
                )}
              </article>
            ))}
        </div>
      </div>

      {editing && <PostForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} artists={artists} onSubmit={save} onCancel={() => setEditing(null)} />}
    </section>
  );
}
```
Test-name notes: the row action buttons' accessible names are "Edit Boat Charm" / "Delete Boat Charm" (the `sr-only` span), matched by `/Edit/` and `/Delete/` in tests; the confirm group's `Cancel` button is the only `Cancel` while the form is closed.

`src/app/globals.css` append:
```css
.admin-shell{min-height:60vh}
.admin-grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:28px;padding:20px 8.5% 80px}
.admin-posts .page-head{padding-bottom:0}
.admin-artists{display:flex;flex-direction:column;gap:6px;align-self:start;position:sticky;top:96px}
.admin-artists button{display:flex;justify-content:space-between;gap:8px;text-align:left;border:1px solid var(--line);background:var(--white);border-radius:3px;padding:10px 12px;font:600 12px var(--font-sans),sans-serif;cursor:pointer;color:var(--ink)}
.admin-artists button small{color:var(--muted);font-weight:500;font-size:10px}
.admin-artists button.selected,.admin-artists button:hover{background:var(--green);border-color:var(--green);color:#fff}
.admin-artists button.selected small,.admin-artists button:hover small{color:#fffc}
.admin-toolbar{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.admin-toolbar input{flex:1;min-width:180px}
.admin-toolbar input,.admin-toolbar select{background:var(--white);border:1px solid var(--line);padding:11px 12px;border-radius:3px;font:12px var(--font-sans),sans-serif}
.admin-row{display:grid;grid-template-columns:72px minmax(0,1fr) auto;gap:16px;align-items:center;background:var(--white);border:1px solid #eee7dd;padding:14px;margin-bottom:10px}
.admin-thumb{position:relative;width:72px;height:72px;border-radius:6px;background:var(--cream);display:grid;place-items:center;font-size:30px;overflow:hidden}
.admin-row-main h3{font:500 17px var(--font-serif),serif;margin:0 0 4px}
.admin-row-main p{font-size:11px;color:var(--muted);margin:0 0 4px;line-height:1.6}
.admin-row-main a{color:var(--green);font-weight:700;font-size:11px;margin-left:10px}
.badge{display:inline-block;border-radius:30px;padding:2px 9px;font:700 9px var(--font-sans),sans-serif;letter-spacing:.8px;text-transform:uppercase}
.badge.published{background:#dce2d5;color:var(--green)}
.badge.draft{background:#ead8c5;color:#8a4a2b}
.admin-row-actions,.admin-confirm{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.admin-confirm span{font-size:11px;color:var(--ink)}
.admin-row .button,.admin-actions .button{border:1px solid #cfc5b7;background:transparent;padding:9px 13px;font-size:11px;color:var(--ink)}
.admin-row .button.danger-outline{color:#a74d35;border-color:#e0b9ad}
.button.danger{background:#a74d35;color:#fff;border-color:#a74d35}
.admin-actions .button.primary{background:var(--green);color:#fff;border-color:var(--green)}
.admin-flash{background:#dce2d5;color:var(--green);padding:10px 14px;border-radius:3px;font-size:12px;margin:12px 8.5% 0}
.admin-error{background:#f3d9d2;color:#8a2f1a;padding:10px 14px;border-radius:3px;font-size:12px;margin:12px 0}
.admin-posts>.admin-error{margin:12px 8.5% 0}
.admin-modal{position:fixed;inset:0;background:#1f251dcc;display:grid;place-items:center;z-index:40;padding:16px;overflow-y:auto}
.admin-form-card{background:var(--white);border-radius:6px;padding:24px;width:min(640px,100%);max-height:calc(100vh - 32px);overflow-y:auto}
.admin-form label{display:block;font-size:11px;font-weight:700;margin:12px 0}
.admin-form label small{display:block;font-weight:500;color:var(--muted);margin-top:5px}
.admin-form input,.admin-form select,.admin-form textarea{display:block;width:100%;margin-top:6px;padding:11px;border:1px solid var(--line);background:#fff;font:12px var(--font-sans),sans-serif;border-radius:3px}
.admin-form fieldset{border:1px solid var(--line);border-radius:4px;margin:14px 0;padding:4px 14px 10px}
.admin-form legend{font-size:10px;letter-spacing:1px;color:var(--orange);font-weight:700;padding:0 6px}
.admin-form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.admin-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}
@media(max-width:800px){.admin-grid{grid-template-columns:1fr;padding-left:5%;padding-right:5%}.admin-artists{position:static;flex-direction:row;overflow-x:auto}.admin-artists button{flex:none}.admin-row{grid-template-columns:56px minmax(0,1fr)}.admin-row-actions,.admin-confirm{grid-column:1/-1}.admin-thumb{width:56px;height:56px}.admin-flash,.admin-posts>.admin-error{margin-left:5%;margin-right:5%}}
```
In `PostForm`, rename the contact label `Artist display name` → `Display name` (see note above).

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit` — Expected: all pass, clean. If a `getByLabelText(/^Artist/)` ambiguity or `getByRole('status')` ambiguity appears, fix the markup (not the test): there must be exactly one element labelled starting "Artist", and exactly one `role="status"` inside `PostsAdmin` at a time.

- [ ] **Step 5: Commit**
```bash
git add src/components/PostForm.tsx src/components/PostsAdmin.tsx src/app/globals.css tests/post-form.test.ts tests/posts-admin.test.tsx
git commit -m "feat: admin posts UI with artist sidebar, create/edit/delete and confirm"
```

---

### Task 6: Wire the page, end-to-end verification, docs

**Files:**
- Create: `src/app/admin/posts/page.tsx`
- Modify: `scripts/seo-check.mjs`, `README.md`

**Interfaces:**
- Consumes: `requireAdminPage`, `listProductsForAdmin`, `listArtists`, `PostsAdmin`.
- Produces: route `/admin/posts` (dynamic, admin-only).

- [ ] **Step 1: Page**
`src/app/admin/posts/page.tsx`:
```tsx
import { PostsAdmin } from '@/components/PostsAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { listArtists, listProductsForAdmin } from '@/lib/admin-posts';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  await requireAdminPage(); // never rely on the layout alone
  const [products, artists] = await Promise.all([listProductsForAdmin(), listArtists()]);
  return <PostsAdmin initialProducts={products} initialArtists={artists} />;
}
```

- [ ] **Step 2: Smoke checks** — in `scripts/seo-check.mjs` add before the final `console.log`:
```js
for (const p of ['/api/admin/artists', '/api/admin/products', '/api/admin/products/p1']) ok((await get(p)).status === 401, `${p} → 401 without session`);
const adminAnon = await fetch(BASE + '/admin/posts', { redirect: 'manual' });
ok([302, 303, 307, 308].includes(adminAnon.status) && (adminAnon.headers.get('location') || '').includes('/api/auth/signin'), '/admin/posts redirects anonymous users to sign-in');
ok(!(await adminAnon.text()).includes('Draft'), 'redirect body leaks no admin content');
ok((await get('/robots.txt')).text.includes('Disallow: /admin/'), 'robots.txt disallows /admin/');
ok(!(await get('/sitemap.xml')).text.includes('/admin'), 'sitemap has no admin urls');
```

- [ ] **Step 3: Build + live verification (forged sessions, scratch server)**
```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
export NEXTAUTH_SECRET=testsecret NEXTAUTH_URL=http://localhost:3217 GOOGLE_CLIENT_ID=id GOOGLE_CLIENT_SECRET=sec NEXT_PUBLIC_SITE_URL=http://localhost:3217 ADMIN_EMAILS=boss@example.com
npx next build 2>&1 | grep -E "rror|warning|/admin"      # Expected: /admin, /admin/posts listed as ƒ (dynamic); no errors
(npx next start -p 3217 >/tmp/nx.log 2>&1 &); sleep 4
cp data/db.json /tmp/db.keep.json
ADMIN=$(node -e "import('next-auth/jwt').then(async j=>console.log(await j.encode({token:{email:'boss@example.com'},secret:'testsecret'})))")
CUST=$(node -e "import('next-auth/jwt').then(async j=>console.log(await j.encode({token:{email:'cust@example.com'},secret:'testsecret'})))")
B=localhost:3217; H='content-type: application/json'; CA="Cookie: next-auth.session-token=$ADMIN"; CC="Cookie: next-auth.session-token=$CUST"
echo "anon /admin/posts:     $(curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' $B/admin/posts)"      # Expected: 307 -> .../api/auth/signin?callbackUrl=...
echo "customer /admin/posts: $(curl -s -o /dev/null -w '%{http_code}' -H "$CC" $B/admin/posts)"               # Expected: 404
echo "admin /admin/posts:    $(curl -s -o /dev/null -w '%{http_code}' -H "$CA" $B/admin/posts)"               # Expected: 200
R=$(curl -s -X POST $B/api/products -H "$H" -H "$CA" -d '{"name":"Secret Draft Bangle","category":"Accessories","city":"Jodhpur","pricePaise":12000,"seller":"Marwar Lac","description":"Hidden until published.","stock":3,"status":"DRAFT","imageUrl":"https://cdn.example.com/b.jpg"}'); echo "$R" | cut -c1-90
echo "draft visible to admin page: $(curl -s -H "$CA" $B/admin/posts | grep -c 'Secret Draft Bangle')"          # Expected: >= 1
echo "draft in public API/shop/sitemap/page: $(curl -s $B/api/products | grep -c 'Secret Draft') $(curl -s $B/shop | grep -c 'Secret Draft') $(curl -s $B/sitemap.xml | grep -c 'secret-draft') $(curl -s -o /dev/null -w '%{http_code}' $B/products/secret-draft-bangle-p5)"   # Expected: 0 0 0 404
curl -s -o /dev/null -w 'publish: %{http_code}\n' -X PATCH $B/api/products/p5 -H "$H" -H "$CA" -d '{"status":"APPROVED"}'
echo "after publish page: $(curl -s -o /dev/null -w '%{http_code}' $B/products/secret-draft-bangle-p5)  image in JSON-LD: $(curl -s $B/products/secret-draft-bangle-p5 | grep -c 'cdn.example.com/b.jpg')"   # Expected: 200, >= 1
curl -s -o /dev/null -w 'javascript: url -> %{http_code}\n' -X PATCH $B/api/products/p5 -H "$H" -H "$CA" -d '{"imageUrl":"javascript:alert(1)"}'   # Expected: 400
curl -s -o /dev/null -w 'delete: %{http_code}\n' -X DELETE $B/api/products/p5 -H "$CA"
BASE_URL=http://$B node scripts/seo-check.mjs | grep -E "^FAIL|checks passed|failed"                          # Expected: All SEO checks passed
pkill -f "next start -p 3217"; cp /tmp/db.keep.json data/db.json; git status --short
```
(Port 3100 is occupied on this machine by another app; use 3217.)

- [ ] **Step 4: Manual browser check** (`npm run dev`, sign in with the admin Google account): (a) header shows **Admin**; (b) `/admin/posts` lists all posts with artist counts; (c) **New post** → save as Draft → appears with a Draft badge, not on `/shop`; (d) Edit → Published → appears on `/shop` and its page; (e) paste a valid https image URL → thumbnail in admin and image on the public card; a broken URL → emoji fallback; (f) Delete → confirm → gone, artist vanishes from the sidebar if it was their last post; (g) sign out → `/admin/posts` redirects to sign-in; sign in with a non-admin account → 404.

- [ ] **Step 5: README + commit.** Add under "API endpoints and auth": rows for `GET /api/admin/artists`, `GET /api/admin/products` (`?artist=&status=&q=`), `GET /api/admin/products/:id` — admin only, no-store — and a short "Admin: artists' posts" section: URL `/admin/posts`, drafts vs published, artist = seller name, image URL must be https.
```bash
git add src/app/admin/posts/page.tsx scripts/seo-check.mjs README.md
git commit -m "feat: /admin/posts page, smoke checks, docs"
```

---

## Self-Review

**Spec coverage:** separate view → Tasks 3+6 (`/admin/posts`, own layout, header link); create/edit/delete → Task 5 over existing write APIs (Task 1 adds create-as-draft + `imageUrl`); read → Tasks 2+5 (all-status list, single read, detail via the edit form, artist sidebar); "published shown publicly, drafts admin-only" → status control in form, drafts excluded from every public surface (tests in Task 2, live check in Task 6), public `imageUrl` rendering + JSON-LD (Task 4); artist = seller name → `artistKey` grouping (Task 2); image URL only → Task 1 validation + Task 4 safe rendering.

**Placeholder scan:** no TBD/TODO; every code step contains code. Two intentional instructions to fix markup rather than tests (label ambiguity) are explicit.

**Type consistency:** `AdminArtist`/`artistKey`/`listProductsForAdmin`/`getProductForAdmin`/`listArtists` (Task 2) are used with the same names in Tasks 5–6; `adminGate`/`requireAdminPage` (Task 3) in Task 6; `ProductImage` props (Task 4) match their use in `ProductCard` and `PostsAdmin`; `buildPayload`/`PostForm` props (Task 5) match `PostsAdmin`'s `save`.

**Review Focus coverage:** (1) Task 2 API tests (401/403 bodies leak nothing, public API excludes drafts), Task 3 gate tests, Task 6 live curl + seo-check; (2) Task 1 `imageUrl` rejection table, Task 4 fallback test; (3) Task 2 artist grouping/rename/last-post tests, Task 5 move-artist + delete-last-post tests; (4) Task 5 confirm/Cancel, double-submit, already-deleted 404 tests; (5) Task 5 `buildPayload` rounding/NaN tests and server-error-keeps-typing test.

**Known limits / decisions to confirm:** (a) artist identity is the seller name, so renaming it on one post splits that post off (the form warns about it) — a real artists table would be the next step; (b) the read-only "view" is the list row plus the Edit form (no separate read-only page); (c) `imageUrl` accepts https only (no uploads); (d) contact fields (`artistName`, social links, phone, email) are per post, as already stored; (e) the admin list loads all posts at once — fine at this catalogue size, add pagination if it grows past a few hundred.
