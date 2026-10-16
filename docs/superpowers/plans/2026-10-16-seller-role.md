# Seller Role (own products, admin-only publish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `seller` role: sellers create, read, edit and archive **their own** products but can never publish; only admins publish (and delete, assign roles/owners). Buyers (customers) keep read-only catalog access.

**Architecture:** Roles become `customer | seller | admin`. `admin` still comes from `ADMIN_EMAILS`; `seller` comes from a new Postgres table `user_roles` that admins manage in a new `/admin/users` page. The role is resolved from the DB inside the NextAuth `jwt` callback on every session read, so grants/revocations apply on the next request and a DB failure fails closed to `customer`. Products get a nullable `owner_email`. All write rules live in one place (`src/lib/admin.ts`, driven by an `Actor`), the admin read functions take an owner `Scope`, and the existing `/admin/posts` page is reused and scoped by role.

**Tech Stack:** Next.js 16 App Router, NextAuth v4 (JWT), Drizzle ORM + Postgres (PGlite in tests), Vitest, existing `Toast`/`Breadcrumbs` components and the `rang-rajasthan-design` skill.

**Spec:** No spec doc. Requirements = user message: "seller role can create, read, archive, edit their own product but cannot publish it. Publish can only happen by Admin. Buyers have only Read access". Decisions made with the user: sellers are **assigned by admins in the UI**; sellers use the **same `/admin/posts` page, scoped**; editing a published product as a seller **sends it back to Draft** (admin re-approval); the **existing 5 products are to be removed from the database** (user: "you can remove them"). Baseline behaviour = current code.

## Environment facts

- Node 22: `export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH`. Docker Postgres `rr-postgres` on `localhost:5434` (`npm run db:up`); `.env.local` already has `DATABASE_URL` (do not print it). The user's `next dev` runs on 3000; use port 3217 for scratch servers, never `rm -rf .next`.
- This machine is often overloaded; run the full suite as `npx vitest run --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000`.
- `git` identity is `shellyy0819`; commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push.
- Forged-session checks: `.env.local` holds `NEXTAUTH_SECRET`/`ADMIN_EMAILS`. Mint tokens with a throw-away script inside the repo that calls `process.loadEnvFile('.env.local')` then `encode({token:{email}, secret})` from `next-auth/jwt`; delete the script afterwards. Never print the secret.
- A running `next dev` can serve stale server modules after edits; restart it (or use a scratch `next build` + `next start -p 3217`) before live checks.

## Global Constraints

- Roles are exactly `customer`, `seller`, `admin`. Anything unknown (missing, tampered, lower/upper case variants) is `customer`.
- Seller can: create products (status `DRAFT` or `ARCHIVED` only), read/edit/archive **only products whose `owner_email` equals their session email (case-insensitive)**. Seller can **never**: set/leave a product `APPROVED`, delete a product, assign or change an owner, touch another seller's product, touch workshops, call `/api/admin/summary` or the sellers API.
- Editing a product that is `APPROVED` as a seller (any real content change) sets it to `DRAFT`. An explicit seller status of `DRAFT`/`ARCHIVED` is honoured. A seller PATCH that transitions a `DRAFT`/`ARCHIVED` product to `APPROVED` is `403 'Only an admin can publish a product.'`.
- Another seller's product id answers `404 'Product not found.'` (never 403), so existence is not revealed.
- Customers (buyers) keep today's access: public read APIs/pages and signed-in demo orders/bookings. They get `403` on every product write/admin API.
- `owner_email` and seller emails never appear in public APIs, pages, JSON-LD or the sitemap (`toProduct` stays free of it; only admin-facing reads use `toAdminProduct`).
- Admin keeps every existing ability; admin creating a product gets `owner_email` = their own email unless they pass `ownerEmail`.
- Admin emails (`ADMIN_EMAILS`) can never be added as sellers; removing a seller keeps their products (they become admin-managed, still owned by that email).
- Error messages: `403 'Seller or admin access required.'` (customer on staff routes), `403 'Admin access required.'` (existing), `403 'Only an admin can publish a product.'`, `403 'Only an admin can assign an owner.'`, `404 'Product not found.'`.
- UI follows `.claude/skills/rang-rajasthan-design/SKILL.md` (required `*` markers via `span.lbl`, `Toast` for outcomes, `Breadcrumbs` on every page, shared control sizing).
- Stable package versions only; no new dependencies are needed.

## Review Focus

1. **Cross-seller access:** seller B reading/patching/archiving seller A's product by id (and A's listing in B's lists/artist counts), including emails that differ only by case → always `404`/absent. (Task 2)
2. **Publish bypass attempts:** `status` `APPROVED` on create/patch, `"approved"`/`" APPROVED"` variants (must be `400`, not accepted), editing a published product while sending `status:"APPROVED"` (must land in `DRAFT`), `ownerEmail` injection to hand a product to someone else, `role`/`status` mass-assignment keys. (Task 2)
3. **Role lifecycle:** grant/revoke applies on the very next request; DB error in the role lookup yields `customer` (never seller/admin); `ADMIN_EMAILS` wins over a stray DB row; an admin email cannot be added as seller; removing a seller keeps their products; duplicate add is `409`. (Tasks 1, 3)
4. **Leakage:** `ownerEmail`/seller emails never in public `/api/products`, product pages, JSON-LD or sitemap; sellers API and `/admin/users` are admin-only (401/403/404). (Tasks 2, 3)
5. **Empty catalog after cleanup:** `/`, `/shop`, `/cities/*`, `/sitemap.xml`, and `scripts/seo-check.mjs` must still work with zero products. (Task 5)

---

## File Structure

```
src/db/schema.ts                  # + products.owner_email, + user_roles table
drizzle/0003_*.sql                # generated migration
src/db/mappers.ts                 # + toAdminProduct
src/db/seed.ts                    # truncateAll also clears user_roles
src/lib/types.ts                  # + AdminProduct
src/lib/authz.ts                  # Role incl. seller, asRole, requireStaff, Actor, actorOf
src/lib/roles.ts                  # NEW resolveRole (admin env → DB seller → customer, fail closed)
src/lib/admin-gate.ts             # + staffGate
src/lib/admin-page.ts             # + requireStaffPage (returns the user)
src/auth.ts                       # jwt callback uses resolveRole; session role via asRole
src/types-next-auth.d.ts          # role union
src/lib/admin.ts                  # actor-aware createProduct/updateProduct (+ ownerEmail)
src/lib/admin-posts.ts            # owner Scope on reads, AdminProduct results, scopeFor
src/lib/sellers.ts                # NEW listSellers/addSeller/removeSeller
src/app/api/products/route.ts, [id]/route.ts                 # requireStaff + actor
src/app/api/admin/{products,products/[id],artists}/route.ts  # requireStaff + scope
src/app/api/admin/sellers/route.ts, sellers/[email]/route.ts # NEW (admin only)
src/app/admin/layout.tsx          # staff gate + section tabs
src/app/admin/posts/page.tsx      # staff gate, scoped data, role prop, crumbs
src/app/admin/users/page.tsx      # NEW admin-only sellers page
src/components/SellersAdmin.tsx   # NEW
src/components/PostsAdmin.tsx, PostForm.tsx, AuthButton.tsx  # role-aware UI
scripts/seo-check.mjs             # product checks discover a product (skip when none)
data/db.json                      # products: [] , counters kept
tests/helpers/actors.ts           # NEW admin/seller/seller2 actors
tests/{roles,sellers,seller-products,sellers-api,sellers-admin}.test.ts(x) # NEW
```

---

### Task 1: Roles, schema and session plumbing

**Files:**
- Modify: `src/db/schema.ts`, `src/db/mappers.ts`, `src/db/seed.ts`, `src/lib/types.ts`, `src/lib/authz.ts`, `src/lib/admin-gate.ts`, `src/lib/admin-page.ts`, `src/auth.ts`, `src/types-next-auth.d.ts`, `src/app/admin/layout.tsx`
- Create: `src/lib/roles.ts`, `drizzle/0003_*.sql` (generated), `tests/helpers/actors.ts`, `tests/roles.test.ts`
- Modify (tests): `tests/authz.test.ts`, `tests/admin-gate.test.tsx`, `tests/db-schema.test.ts`

**Interfaces:**
- Produces:
  - `authz.ts`: `type Role = 'customer'|'seller'|'admin'`; `asRole(v: unknown): Role`; `type StaffUser = SessionUser & { role: 'admin'|'seller' }`; `requireStaff(session): StaffUser`; `type Actor = { email: string; role: 'admin'|'seller' }`; `actorOf(u: StaffUser): Actor`.
  - `roles.ts`: `resolveRole(email: string): Promise<Role>`.
  - `admin-gate.ts`: `staffGate(session): Gate`.
  - `admin-page.ts`: `requireStaffPage(): Promise<StaffUser>` (redirects anonymous, 404s customers); `requireAdminPage()` unchanged (admin only).
  - schema: `products.ownerEmail`, `userRoles` table; `mappers.ts`: `toAdminProduct(row): AdminProduct`; `types.ts`: `AdminProduct = Product & { ownerEmail?: string }`.
  - `tests/helpers/actors.ts`: `admin`, `seller`, `seller2` (type `Actor`).

- [ ] **Step 1: Write failing tests** `tests/roles.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveRole } from '@/lib/roles';
import { asRole, requireStaff, actorOf } from '@/lib/authz';
import { authOptions } from '@/auth';
import { setDb } from '@/db/client';
import { userRoles } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

const origAdmins = process.env.ADMIN_EMAILS;
beforeEach(async () => { process.env.ADMIN_EMAILS = 'boss@shop.com'; await resetTestDb(); });
afterEach(() => { process.env.ADMIN_EMAILS = origAdmins; });

const grant = async (email: string) => (await getTestDb()).insert(userRoles).values({ email, createdBy: 'boss@shop.com' });

describe('resolveRole', () => {
  it('admin env wins, DB seller row makes a seller (case-insensitive), everyone else is a customer', async () => {
    await grant('seller@x.co');
    expect(await resolveRole('Boss@Shop.com')).toBe('admin');
    expect(await resolveRole('SELLER@x.co')).toBe('seller');
    expect(await resolveRole('buyer@x.co')).toBe('customer');
  });
  it('an admin email that also has a seller row is still admin', async () => {
    await grant('boss@shop.com');
    expect(await resolveRole('boss@shop.com')).toBe('admin');
  });
  it('revocation applies on the next lookup', async () => {
    await grant('seller@x.co');
    expect(await resolveRole('seller@x.co')).toBe('seller');
    const { eq } = await import('drizzle-orm');
    await (await getTestDb()).delete(userRoles).where(eq(userRoles.email, 'seller@x.co'));
    expect(await resolveRole('seller@x.co')).toBe('customer');
  });
  it('fails closed to customer when the database errors', async () => {
    setDb({ select() { throw new Error('db down'); } } as never);
    expect(await resolveRole('seller@x.co')).toBe('customer');
    expect(await resolveRole('boss@shop.com')).toBe('admin'); // env admin never needs the DB
  });
});

describe('session callbacks use the resolved role', () => {
  it('jwt callback puts the DB role in the token; session callback exposes only known roles', async () => {
    await grant('seller@x.co');
    const jwt = authOptions.callbacks!.jwt!;
    const t = await jwt({ token: { email: 'seller@x.co' } } as never);
    expect((t as { role: string }).role).toBe('seller');
    const s = await authOptions.callbacks!.session!({ session: { user: { email: 'x' } }, token: { role: 'god' } } as never);
    expect((s as { user: { role: string } }).user.role).toBe('customer');
  });
});

describe('authz helpers', () => {
  it('asRole only accepts the three roles', () => {
    expect([asRole('admin'), asRole('seller'), asRole('customer'), asRole('SELLER'), asRole(undefined), asRole({})]).toEqual(['admin', 'seller', 'customer', 'customer', 'customer', 'customer']);
  });
  it('requireStaff: 401 anonymous, 403 customer, ok for seller/admin', () => {
    expect(() => requireStaff(null)).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => requireStaff({ user: { email: 'c@x.co', role: 'customer' } })).toThrowError(expect.objectContaining({ status: 403, message: 'Seller or admin access required.' }));
    expect(requireStaff({ user: { email: 's@x.co', role: 'seller' } }).role).toBe('seller');
    expect(actorOf(requireStaff({ user: { email: 'a@x.co', role: 'admin' } }))).toEqual({ email: 'a@x.co', role: 'admin' });
  });
});
```
Also append to `tests/admin-gate.test.tsx`: `staffGate` returns `'signin'` for anonymous, `'forbidden'` for customer/role-less, `'ok'` for seller and admin; and the AuthButton shows a **My products** link (href `/admin/posts`) for a seller session and the **Admin** link only for admins. Append to `tests/db-schema.test.ts`: `user_roles` rejects `role='boss'`; `products.owner_email` is nullable and round-trips; `truncateAll` empties `user_roles`.

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/roles.test.ts` → FAIL (`@/lib/roles` missing).

- [ ] **Step 3: Schema + migration.** In `src/db/schema.ts` add to `products`: `ownerEmail: text('owner_email'),` and `index('products_owner_idx').on(t.ownerEmail),` in the extras array; append:

```ts
// Role assignments managed by admins (admins themselves come from ADMIN_EMAILS). Emails are stored lower-case.
export const userRoles = pgTable('user_roles', {
  email: text('email').primaryKey(),
  role: text('role').notNull().default('seller'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
}, t => [check('user_roles_role_valid', sql`${t.role} in ('seller')`)]);
```
Run `npx drizzle-kit generate --name seller_roles` and check `drizzle/0003_seller_roles.sql` contains `CREATE TABLE "user_roles"`, `ALTER TABLE "products" ADD COLUMN "owner_email"` and the index. In `src/db/seed.ts` change the truncate statement to `truncate table order_items, orders, bookings, products, workshops, id_counters, user_roles restart identity cascade`.

- [ ] **Step 4: Types, mapper, authz.**
`src/lib/types.ts`: `export type AdminProduct = Product & { ownerEmail?: string };`
`src/db/mappers.ts`: add `import type { AdminProduct, … }` and

```ts
export const toAdminProduct = (r: ProductRow): AdminProduct => ({ ...toProduct(r), ...opt('ownerEmail', r.ownerEmail) });
```
(`toProduct` is unchanged: public paths must never expose the owner.)
`src/lib/authz.ts` becomes:

```ts
import { ApiError } from './errors';

export type Role = 'customer' | 'seller' | 'admin';
export type SessionUser = { email: string; role: Role; name?: string | null };
export type StaffUser = SessionUser & { role: 'admin' | 'seller' };
export type Actor = { email: string; role: 'admin' | 'seller' };
export type AppSession = { user?: { email?: string | null; role?: Role; name?: string | null } } | null;

const ROLES: readonly unknown[] = ['customer', 'seller', 'admin'];
export const asRole = (v: unknown): Role => (ROLES.includes(v) ? (v as Role) : 'customer');

/** Env-based admin check only. Sellers live in the database: see resolveRole in roles.ts. */
export function roleFor(email: string, adminEmails = process.env.ADMIN_EMAILS): Role {
  const admins = (adminEmails ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.trim().toLowerCase()) ? 'admin' : 'customer';
}

export function requireUser(session: AppSession): SessionUser {
  const email = session?.user?.email;
  if (!email) throw new ApiError(401, 'Authentication required.');
  return { email, role: asRole(session?.user?.role), name: session?.user?.name };
}

export function requireStaff(session: AppSession): StaffUser {
  const user = requireUser(session);
  if (user.role === 'customer') throw new ApiError(403, 'Seller or admin access required.');
  return user as StaffUser;
}

export const actorOf = (u: StaffUser): Actor => ({ email: u.email, role: u.role });

export function requireAdmin(session: AppSession): SessionUser {
  const user = requireUser(session);
  if (user.role !== 'admin') throw new ApiError(403, 'Admin access required.');
  return user;
}
```
`src/lib/roles.ts`:

```ts
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { userRoles } from '../db/schema';
import { roleFor, type Role } from './authz';

/** admin (ADMIN_EMAILS) → seller (user_roles row) → customer. A database error fails closed to customer. */
export async function resolveRole(email: string): Promise<Role> {
  const e = email.trim().toLowerCase();
  if (roleFor(e) === 'admin') return 'admin';
  try {
    const [row] = await getDb().select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.email, e));
    return row ? 'seller' : 'customer';
  } catch (err) {
    console.error('role lookup failed; treating the user as a customer', err);
    return 'customer';
  }
}
```
`src/auth.ts`: import `resolveRole` and `asRole`; in the callbacks set `token.role = token.email ? await resolveRole(token.email) : 'customer';` and `if (session.user) session.user.role = asRole(token.role);`. `src/types-next-auth.d.ts`: both `role?` unions become `'customer' | 'seller' | 'admin'`.
`src/lib/admin-gate.ts` add:

```ts
export function staffGate(session: AppSession): Gate {
  if (!session?.user?.email) return 'signin';
  const r = session.user.role;
  return r === 'admin' || r === 'seller' ? 'ok' : 'forbidden';
}
```
`src/lib/admin-page.ts` add (keep `requireAdminPage` as is):

```ts
import { requireStaff, type StaffUser } from './authz';
import { adminGate, staffGate } from './admin-gate';
// Call from the admin layout AND every page (layouts and pages render independently).
export async function requireStaffPage(): Promise<StaffUser> {
  const session = await auth();
  const gate = staffGate(session);
  if (gate === 'signin') redirect('/api/auth/signin?callbackUrl=%2Fadmin%2Fposts');
  if (gate === 'forbidden') notFound();
  return requireStaff(session);
}
```
`src/app/admin/layout.tsx`: replace `requireAdminPage()` with `await requireStaffPage();` (tabs come in Task 3). Update `AuthButton`: `role === 'admin'` → `<Link href="/admin/posts">Admin</Link>`; `role === 'seller'` → `<Link href="/admin/posts">My products</Link>`; sign-out label `' (admin)'`/`' (seller)'`.
`tests/helpers/actors.ts`:

```ts
import type { Actor } from '@/lib/authz';
export const admin: Actor = { email: 'root@x.co', role: 'admin' };
export const seller: Actor = { email: 'seller@x.co', role: 'seller' };
export const seller2: Actor = { email: 'other@x.co', role: 'seller' };
```

- [ ] **Step 5: Run to verify GREEN** — `npx vitest run tests/roles.test.ts tests/authz.test.ts tests/admin-gate.test.tsx tests/db-schema.test.ts` then `npx tsc --noEmit -p tsconfig.json` (ignore a stale `.next/dev/types/validator.ts` error). Expected: PASS, no type errors. Mutation check: make `resolveRole` return `'seller'` in the `catch` → the fail-closed test must FAIL; revert.

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: seller role plumbing (user_roles, owner_email, resolveRole, staff gates)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Seller-scoped product rules and APIs

**Files:**
- Modify: `src/lib/admin.ts`, `src/lib/admin-posts.ts`, `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[id]/route.ts`, `src/app/api/admin/artists/route.ts`
- Modify (tests): every test calling `createProduct`/`updateProduct` (`tests/admin.test.ts`, `tests/admin-api.test.ts` helper calls, `tests/admin-posts-api.test.ts`, `tests/orders.test.ts`, `tests/pg-concurrency.test.ts`, `tests/admin-posts.test.ts`), mock sessions in route tests
- Create: `tests/seller-products.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Actor`, `requireStaff`, `actorOf`, `toAdminProduct`, `AdminProduct`, test actors).
- Produces:
  - `admin.ts`: `createProduct(input: unknown, actor: Actor): Promise<AdminProduct>`, `updateProduct(id: string, input: unknown, actor: Actor): Promise<AdminProduct>`; `deleteProduct(id)` unchanged (route is admin-only); workshops unchanged.
  - `admin-posts.ts`: `type Scope = { ownerEmail?: string }`, `scopeFor(u: { email: string; role: Role }): Scope`, `listProductsForAdmin(f?, scope?: Scope): Promise<AdminProduct[]>`, `getProductForAdmin(id, scope?): Promise<AdminProduct>`, `listArtists(scope?): Promise<AdminArtist[]>`.

- [ ] **Step 1: Write failing tests** `tests/seller-products.test.ts` (service level):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createProduct, updateProduct, deleteProduct } from '@/lib/admin';
import { getProductForAdmin, listArtists, listProductsForAdmin, scopeFor } from '@/lib/admin-posts';
import { listProducts, getProductBySlug } from '@/lib/catalog';
import { admin, seller, seller2 } from './helpers/actors';
import { resetTestDb, snapshot } from './helpers/testdb';

const base = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, seller: 'Marwar Lac', description: 'Hand-set.', stock: 3 };
beforeEach(async () => { await resetTestDb(); });
const mine = (a = seller) => scopeFor({ email: a.email, role: a.role });

describe('seller create', () => {
  it('defaults to DRAFT, records the owner (lower-cased), and may create an ARCHIVED one', async () => {
    const p = await createProduct(base, { email: 'Seller@X.co', role: 'seller' });
    expect(p).toMatchObject({ status: 'DRAFT', ownerEmail: 'seller@x.co' });
    expect((await createProduct({ ...base, status: 'ARCHIVED' }, seller)).status).toBe('ARCHIVED');
  });
  it('can never create a published product', async () => {
    await expect(createProduct({ ...base, status: 'APPROVED' }, seller)).rejects.toMatchObject({ status: 403, message: 'Only an admin can publish a product.' });
    for (const status of ['approved', ' APPROVED', 'APPROVED ', 'Published']) await expect(createProduct({ ...base, status }, seller)).rejects.toMatchObject({ status: 400 });
    expect((await listProducts()).map(p => p.name)).not.toContain('Lac Bangle');
  });
  it('cannot assign someone else as owner; an owner equal to self is fine', async () => {
    await expect(createProduct({ ...base, ownerEmail: 'other@x.co' }, seller)).rejects.toMatchObject({ status: 403, message: 'Only an admin can assign an owner.' });
    expect((await createProduct({ ...base, ownerEmail: 'SELLER@x.co' }, seller)).ownerEmail).toBe('seller@x.co');
  });
  it('unknown keys such as role are ignored', async () => {
    const p = await createProduct({ ...base, role: 'admin', ownerRole: 'admin' }, seller);
    expect(p).not.toHaveProperty('role');
  });
});

describe('admin create/own', () => {
  it('admin defaults: APPROVED, owner = admin email; may assign an owner or leave it empty', async () => {
    expect(await createProduct(base, admin)).toMatchObject({ status: 'APPROVED', ownerEmail: 'root@x.co' });
    expect((await createProduct({ ...base, ownerEmail: 'Seller@x.co' }, admin)).ownerEmail).toBe('seller@x.co');
    expect((await createProduct({ ...base, ownerEmail: '' }, admin))).not.toHaveProperty('ownerEmail');
    await expect(createProduct({ ...base, ownerEmail: 'not-an-email' }, admin)).rejects.toMatchObject({ status: 400 });
  });
});

describe('seller edit / archive / publish rules', () => {
  it('edits own DRAFT keeping it DRAFT; archives and restores to DRAFT; cannot publish', async () => {
    const p = await createProduct(base, seller);
    expect((await updateProduct(p.id, { name: 'New name' }, seller))).toMatchObject({ name: 'New name', status: 'DRAFT' });
    expect((await updateProduct(p.id, { status: 'ARCHIVED' }, seller)).status).toBe('ARCHIVED');
    expect((await updateProduct(p.id, { status: 'DRAFT' }, seller)).status).toBe('DRAFT');
    await expect(updateProduct(p.id, { status: 'APPROVED' }, seller)).rejects.toMatchObject({ status: 403 });
    await updateProduct(p.id, { status: 'ARCHIVED' }, seller);
    await expect(updateProduct(p.id, { status: 'APPROVED' }, seller)).rejects.toMatchObject({ status: 403 });
    expect((await snapshot()).products.find(x => x.id === p.id)!.status).toBe('ARCHIVED');
  });
  it('editing a published product sends it back to DRAFT (even if the seller sends status APPROVED)', async () => {
    const p = await createProduct({ ...base, ownerEmail: seller.email }, admin); // admin-created, owned by the seller, APPROVED
    expect((await updateProduct(p.id, { stock: 9 }, seller)).status).toBe('DRAFT');
    await updateProduct(p.id, { status: 'APPROVED' }, admin);
    expect((await updateProduct(p.id, { description: 'changed', status: 'APPROVED' }, seller)).status).toBe('DRAFT');
    expect((await listProducts()).map(x => x.id)).not.toContain(p.id);
  });
  it('a no-op save of a published product keeps it published; archiving a published one is allowed', async () => {
    const p = await createProduct({ ...base, ownerEmail: seller.email }, admin);
    expect((await updateProduct(p.id, {}, seller)).status).toBe('APPROVED');
    expect((await updateProduct(p.id, { status: 'APPROVED' }, seller)).status).toBe('APPROVED');
    expect((await updateProduct(p.id, { status: 'ARCHIVED' }, seller)).status).toBe('ARCHIVED');
  });
  it('admin publishes and may reassign the owner; seller cannot change the owner', async () => {
    const p = await createProduct(base, seller);
    expect((await updateProduct(p.id, { status: 'APPROVED' }, admin)).status).toBe('APPROVED');
    expect((await updateProduct(p.id, { ownerEmail: 'other@x.co' }, admin)).ownerEmail).toBe('other@x.co');
    await expect(updateProduct(p.id, { stock: 1 }, seller)).rejects.toMatchObject({ status: 404 });
    const q = await createProduct(base, seller);
    await expect(updateProduct(q.id, { ownerEmail: 'other@x.co' }, seller)).rejects.toMatchObject({ status: 403 });
  });
  it('failed validation leaves the row unchanged', async () => {
    const p = await createProduct(base, seller);
    await expect(updateProduct(p.id, { stock: -1 }, seller)).rejects.toMatchObject({ status: 400 });
    expect((await snapshot()).products.find(x => x.id === p.id)!.stock).toBe(3);
  });
});

describe('cross-seller isolation (Review Focus 1)', () => {
  it("seller B gets 404 on seller A's product for read/edit/archive and sees none of it in lists or counts", async () => {
    const a = await createProduct({ ...base, seller: 'Alpha Artist' }, seller);
    await createProduct({ ...base, seller: 'Beta Artist' }, seller2);
    for (const fn of [() => getProductForAdmin(a.id, mine(seller2)), () => updateProduct(a.id, { stock: 1 }, seller2), () => updateProduct(a.id, { status: 'ARCHIVED' }, seller2)])
      await expect(fn()).rejects.toMatchObject({ status: 404, message: 'Product not found.' });
    expect((await listProductsForAdmin({}, mine(seller2))).map(p => p.seller)).toEqual(['Beta Artist']);
    expect((await listArtists(mine(seller2))).map(x => x.name)).toEqual(['Beta Artist']);
    expect((await listProductsForAdmin({}, mine(seller))).map(p => p.seller)).toEqual(['Alpha Artist']);
    expect((await snapshot()).products.find(x => x.id === a.id)!.status).toBe('DRAFT');
  });
  it('owner matching ignores email case; legacy products with no owner belong to nobody but admins', async () => {
    const p = await createProduct(base, { email: 'Seller@X.co', role: 'seller' });
    expect((await getProductForAdmin(p.id, mine(seller))).id).toBe(p.id);
    expect((await listProductsForAdmin({}, mine(seller))).map(x => x.id)).toContain(p.id);
    expect((await listProductsForAdmin({}, mine(seller))).map(x => x.id)).not.toContain('p1'); // fixture p1 has no owner
    expect((await listProductsForAdmin({}, scopeFor({ email: admin.email, role: 'admin' }))).length).toBeGreaterThan(4);
  });
  it('sellers cannot see admin-owned products and scopeFor(admin) is unscoped', async () => {
    const adminOwned = await createProduct(base, admin);
    await expect(getProductForAdmin(adminOwned.id, mine(seller))).rejects.toMatchObject({ status: 404 });
    expect(scopeFor({ email: 'a@x.co', role: 'admin' })).toEqual({});
  });
});

describe('leakage (Review Focus 4)', () => {
  it('owner emails never appear in the public catalog', async () => {
    const p = await createProduct({ ...base, status: 'APPROVED', ownerEmail: 'secret-owner@x.co' }, admin);
    const pub = await listProducts();
    expect(JSON.stringify(pub)).not.toContain('secret-owner');
    expect(JSON.stringify(await getProductBySlug(`lac-bangle-${p.id}`))).not.toContain('secret-owner');
  });
});

describe('delete is admin-only at the route; service still deletes for admin', () => {
  it('admin delete works', async () => {
    const p = await createProduct(base, seller);
    await deleteProduct(p.id);
    expect((await snapshot()).products.find(x => x.id === p.id)).toBeUndefined();
  });
});
```
Also add a route-level test file section appended to `tests/admin-api.test.ts` (mock `auth` as seller/customer/admin using the existing `asCustomer/asAdmin` helpers plus `asSeller = () => authMock.mockResolvedValue({ user: { email: 'seller@x.co', role: 'seller' } })`): customer `POST /api/products` → 403 `'Seller or admin access required.'`; seller `POST` with no status → 201 `DRAFT` and owner `seller@x.co`; seller `POST` with `status:'APPROVED'` → 403; seller `PATCH` own → 200, other's → 404, `status:'APPROVED'` → 403; seller `DELETE` → 403 `'Admin access required.'`; seller `POST /api/workshops`, `PATCH/DELETE /api/workshops/:id` → 403; seller `GET /api/admin/summary` → 403. In `tests/admin-posts-api.test.ts` (existing mock pattern `asAdmin`) add `asSeller`: seller `GET /api/admin/products` returns only own products (create one as the seller and one as admin through the service), `GET /api/admin/products/:id` for another's → 404, `GET /api/admin/artists` only own artist groups; customer → 403 on all three; admin still sees all with `ownerEmail` present; public `GET /api/products` JSON never contains `ownerEmail`.

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/seller-products.test.ts` → FAIL (signatures/exports missing; also `tsc` will list every call site missing the new `actor` argument).

- [ ] **Step 3: Implement `src/lib/admin.ts`.** Keep every existing validator. Add imports (`toAdminProduct`, `userRoles` is not needed here, `AdminProduct`, `Actor`) and the helpers/functions below. Replace `createProduct` and `updateProduct` (leave `deleteProduct` and the workshop functions):

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLISH_DENIED = () => new ApiError(403, 'Only an admin can publish a product.');
const OWNER_DENIED = () => new ApiError(403, 'Only an admin can assign an owner.');

/** undefined = key not sent, null = explicitly cleared, string = lower-cased valid email. */
function ownerEmailOf(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length > 254 || !EMAIL_RE.test(v.trim())) throw bad('ownerEmail must be a valid email.');
  return v.trim().toLowerCase();
}
const sameEmail = (a: string | null | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();
const contentOf = (p: Omit<Product, 'id'>) => { const { status: _s, ...rest } = toProductRow(p); return JSON.stringify(rest); };

export async function createProduct(input: unknown, actor: Actor): Promise<AdminProduct> {
  const raw = pick(obj(input), [...PRODUCT_KEYS, 'ownerEmail']);
  const owner = ownerEmailOf(raw.ownerEmail);
  delete raw.ownerEmail;
  const self = actor.email.toLowerCase();
  if (actor.role === 'seller') {
    if (owner !== undefined && owner !== self) throw OWNER_DENIED();
    if (raw.status === undefined) raw.status = 'DRAFT';
  }
  const data = validateProduct(raw);
  if (actor.role === 'seller' && data.status === 'APPROVED') throw PUBLISH_DENIED();
  const ownerEmail = actor.role === 'seller' ? self : owner === undefined ? self : owner;
  return getDb().transaction(async tx => {
    const id = await allocateId(tx, 'p');
    const [row] = await tx.insert(productsT).values({ id, ...toProductRow(data), ownerEmail }).returning();
    return toAdminProduct(row);
  });
}

export async function updateProduct(id: string, input: unknown, actor: Actor): Promise<AdminProduct> {
  const raw = pick(obj(input), [...PRODUCT_KEYS, 'ownerEmail']);
  const owner = ownerEmailOf(raw.ownerEmail);
  delete raw.ownerEmail;
  const seller = actor.role === 'seller';
  if (seller && owner !== undefined && owner !== actor.email.toLowerCase()) throw OWNER_DENIED();
  return getDb().transaction(async tx => {
    const [row] = await tx.select().from(productsT).where(eq(productsT.id, id)).for('update');
    // A seller must not learn that someone else's product exists.
    if (!row || (seller && !sameEmail(row.ownerEmail, actor.email))) throw new ApiError(404, 'Product not found.');
    const current = toProduct(row);
    let next = validateProduct({ ...current, ...raw });
    if (seller) {
      if (row.status !== 'APPROVED' && next.status === 'APPROVED') throw PUBLISH_DENIED();
      // A live listing whose content changed goes back to review.
      if (row.status === 'APPROVED' && next.status === 'APPROVED' && contentOf(next) !== contentOf(current)) next = { ...next, status: 'DRAFT' };
    }
    const ownerEmail = seller || owner === undefined ? row.ownerEmail : owner;
    const [saved] = await tx.update(productsT).set({ ...toProductRow(next), ownerEmail }).where(eq(productsT.id, id)).returning();
    return toAdminProduct(saved);
  });
}
```
(Import `Actor` from `./authz`, `AdminProduct` from `./types`, and `toAdminProduct` from `../db/mappers`.)

- [ ] **Step 4: Implement `src/lib/admin-posts.ts` reads.** Add and wire (queries otherwise unchanged):

```ts
import type { Role } from './authz';
import { toAdminProduct } from '../db/mappers';
import type { AdminProduct } from './types';

export type Scope = { ownerEmail?: string };
export const scopeFor = (u: { email: string; role: Role }): Scope => (u.role === 'admin' ? {} : { ownerEmail: u.email });
const scopeWhere = (s: Scope): SQL[] => (s.ownerEmail ? [sql`lower(${products.ownerEmail}) = ${s.ownerEmail.toLowerCase()}`] : []);
```
`listProductsForAdmin(f = {}, scope: Scope = {})`: `where.push(...scopeWhere(scope))`, return `rows.map(toAdminProduct)`. `getProductForAdmin(id, scope: Scope = {})`: `.where(and(eq(products.id, id), ...scopeWhere(scope)))`, `toAdminProduct`. `listArtists(scope: Scope = {})`: add `.where(and(...scopeWhere(scope)))` before `.groupBy(keySql)`. Change the return type of the first two to `AdminProduct`.

- [ ] **Step 5: Routes.**
`src/app/api/products/route.ts` POST: `const user = requireStaff(await auth()); const created = await createProduct(await readJson(req), actorOf(user));` (imports `requireStaff, actorOf` instead of `requireAdmin`).
`src/app/api/products/[id]/route.ts` PATCH: `const user = requireStaff(await auth()); const updated = await updateProduct((await params).id, await readJson(req), actorOf(user));` — DELETE keeps `requireAdmin`.
`src/app/api/admin/products/route.ts` GET: `const user = requireStaff(await auth());` pass `scopeFor(user)` as the second argument to `listProductsForAdmin`. `src/app/api/admin/products/[id]/route.ts` GET: `getProductForAdmin(id, scopeFor(requireStaff(await auth())))` (keep `no-store`). `src/app/api/admin/artists/route.ts`: `listArtists(scopeFor(requireStaff(await auth())))`. `/api/admin/summary` and all workshop write routes stay `requireAdmin`.

- [ ] **Step 6: Migrate every existing call site.** Run `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/dev"` — it lists each `createProduct(`/`updateProduct(` call without an actor. Add `, admin` (import `{ admin } from './helpers/actors'`) to each in `tests/admin.test.ts`, `tests/admin-posts-api.test.ts`, `tests/admin-api.test.ts`, `tests/orders.test.ts`, `tests/admin-posts.test.ts`, `tests/pg-concurrency.test.ts`. Update assertions that compared whole products from `createProduct`/`updateProduct` (they now also contain `ownerEmail: 'root@x.co'`); the "optional fields are absent" tests must use `toMatchObject`/`not.toHaveProperty` instead of `toEqual`.

- [ ] **Step 7: Run to verify GREEN** — `npx vitest run tests/seller-products.test.ts tests/admin.test.ts tests/admin-api.test.ts tests/admin-posts-api.test.ts tests/admin-posts.test.ts tests/orders.test.ts` then the whole suite (flags in Environment facts) and `npx tsc --noEmit`. Expected: all pass. Mutation spot-checks (revert each): remove the `sameEmail` 404 guard → isolation tests FAIL; delete the `PUBLISH_DENIED` check in `updateProduct` → publish tests FAIL; delete the demote-to-DRAFT block → "editing a published product" tests FAIL.

- [ ] **Step 8: Commit**
```bash
git add -A && git commit -m "feat: seller-scoped product create/edit/archive, admin-only publish, owner scoping

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin manages sellers (API + /admin/users page)

**Files:**
- Create: `src/lib/sellers.ts`, `src/app/api/admin/sellers/route.ts`, `src/app/api/admin/sellers/[email]/route.ts`, `src/app/admin/users/page.tsx`, `src/components/SellersAdmin.tsx`, `tests/sellers.test.ts`, `tests/sellers-api.test.ts`, `tests/sellers-admin.test.tsx`
- Modify: `src/app/admin/layout.tsx` (section tabs), `src/app/globals.css` (`.admin-tabs`), `src/app/robots.ts` only if needed (already disallows `/admin/` and `/api/`)

**Interfaces:**
- Consumes: Task 1 (`userRoles`, `roleFor`, `requireAdmin`, `requireStaffPage`, `requireAdminPage`), Task 2 (`products.owner_email`).
- Produces: `sellers.ts`: `type SellerRow = { email: string; createdAt: string; createdBy: string; products: number }`, `listSellers(): Promise<SellerRow[]>`, `addSeller(input: unknown, adminEmail: string): Promise<SellerRow>`, `removeSeller(email: string): Promise<void>`; routes `GET|POST /api/admin/sellers`, `DELETE /api/admin/sellers/:email` (all `requireAdmin`, `no-store` on GET); `<SellersAdmin initialSellers={SellerRow[]} />`.

- [ ] **Step 1: Write failing tests.**
`tests/sellers.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { addSeller, listSellers, removeSeller } from '@/lib/sellers';
import { createProduct } from '@/lib/admin';
import { resolveRole } from '@/lib/roles';
import { admin, seller } from './helpers/actors';
import { resetTestDb } from './helpers/testdb';

const orig = process.env.ADMIN_EMAILS;
beforeEach(async () => { process.env.ADMIN_EMAILS = 'root@x.co'; await resetTestDb(); });
afterEach(() => { process.env.ADMIN_EMAILS = orig; });
const base = { name: 'N', category: 'Pottery', city: 'Jaipur', pricePaise: 1, seller: 'S', description: 'D', stock: 1 };

describe('sellers', () => {
  it('adds a seller (trimmed, lower-cased), records who added them, and resolveRole sees it immediately', async () => {
    const row = await addSeller({ email: '  New.Seller@X.co ' }, 'root@x.co');
    expect(row).toMatchObject({ email: 'new.seller@x.co', createdBy: 'root@x.co', products: 0 });
    expect(await resolveRole('NEW.seller@x.co')).toBe('seller');
    expect((await listSellers()).map(s => s.email)).toEqual(['new.seller@x.co']);
  });
  it('rejects invalid emails, admin emails, and duplicates', async () => {
    for (const email of ['', 'nope', 'a@b', 'a b@c.co', 'x'.repeat(260) + '@x.co', 5, null]) await expect(addSeller({ email }, 'root@x.co')).rejects.toMatchObject({ status: 400 });
    await expect(addSeller({ email: 'ROOT@x.co' }, 'root@x.co')).rejects.toMatchObject({ status: 400, message: 'That email is already an admin.' });
    await addSeller({ email: 'dup@x.co' }, 'root@x.co');
    await expect(addSeller({ email: 'DUP@x.co' }, 'root@x.co')).rejects.toMatchObject({ status: 409, message: 'Already a seller.' });
    await expect(addSeller(null, 'root@x.co')).rejects.toMatchObject({ status: 400 });
  });
  it('counts each seller\'s products and removing a seller revokes the role but keeps the products', async () => {
    await addSeller({ email: seller.email }, 'root@x.co');
    await createProduct(base, seller); await createProduct(base, seller); await createProduct(base, admin);
    expect((await listSellers())[0].products).toBe(2);
    await removeSeller('SELLER@x.co');
    expect(await resolveRole(seller.email)).toBe('customer');
    expect(await listSellers()).toEqual([]);
    const { listProductsForAdmin } = await import('@/lib/admin-posts');
    expect((await listProductsForAdmin({ q: '' })).filter(p => p.ownerEmail === seller.email)).toHaveLength(2);
    await expect(removeSeller('seller@x.co')).rejects.toMatchObject({ status: 404 });
  });
});
```
`tests/sellers-api.test.ts` (same mock pattern as `tests/admin-api.test.ts`: mock `@/auth`, `next/cache`): anonymous → 401 and customer/seller → 403 on `GET`, `POST`, `DELETE` (and nothing written); admin `POST` `{email}` → 201 with the row, repeated → 409, bad JSON → 400, non-JSON content type → 415; admin `GET` → 200 list with `cache-control: no-store`; admin `DELETE /api/admin/sellers/seller%40x.co` (`ctx = { params: Promise.resolve({ email: 'seller%40x.co' }) }`, and also the already-decoded form `seller@x.co`) → 200 `{ ok: true }`, unknown → 404.
`tests/sellers-admin.test.tsx` (jsdom; mock `fetch` like `tests/posts-admin.test.tsx`; use fake timers only where checking toasts): renders the list with product counts; "Add seller" with an empty email is blocked by `required` (the input is `required` and its label contains `span.lbl`); adding posts `{email}` to `/api/admin/sellers`, shows a green status toast and the new row; a `409` response shows a red alert toast and no GET re-fetch happens after the failed call; Remove asks for confirmation (`Remove seller@x.co? Their products stay.`), confirm sends `DELETE /api/admin/sellers/seller%40x.co`, cancel sends nothing; empty state text `No sellers yet.`.

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/sellers.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/sellers.ts`:**

```ts
import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { userRoles } from '../db/schema';
import { ApiError } from './errors';
import { roleFor } from './authz';

export type SellerRow = { email: string; createdAt: string; createdBy: string; products: number };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const productCount = sql<number>`(select count(*) from products p where lower(p.owner_email) = ${userRoles.email})`.mapWith(Number);
const toRow = (r: { email: string; createdAt: Date; createdBy: string; products: number }): SellerRow =>
  ({ email: r.email, createdAt: r.createdAt.toISOString(), createdBy: r.createdBy, products: r.products });

export async function listSellers(): Promise<SellerRow[]> {
  const rows = await getDb().select({ email: userRoles.email, createdAt: userRoles.createdAt, createdBy: userRoles.createdBy, products: productCount })
    .from(userRoles).orderBy(asc(userRoles.email));
  return rows.map(toRow);
}

export async function addSeller(input: unknown, adminEmail: string): Promise<SellerRow> {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>).email : undefined;
  if (typeof raw !== 'string' || raw.trim().length > 254 || !EMAIL_RE.test(raw.trim())) throw new ApiError(400, 'email must be a valid email address.');
  const email = raw.trim().toLowerCase();
  if (roleFor(email) === 'admin') throw new ApiError(400, 'That email is already an admin.');
  const inserted = await getDb().insert(userRoles).values({ email, createdBy: adminEmail.toLowerCase() }).onConflictDoNothing().returning();
  if (!inserted.length) throw new ApiError(409, 'Already a seller.');
  return toRow({ ...inserted[0], products: (await listSellers()).find(s => s.email === email)?.products ?? 0 });
}

export async function removeSeller(email: string): Promise<void> {
  const rows = await getDb().delete(userRoles).where(eq(userRoles.email, email.trim().toLowerCase())).returning({ email: userRoles.email });
  if (!rows.length) throw new ApiError(404, 'Seller not found.');
}
```

- [ ] **Step 4: Routes.**
`src/app/api/admin/sellers/route.ts`:

```ts
import { auth } from '@/auth';
import { handle, json, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { addSeller, listSellers } from '@/lib/sellers';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  return json(await listSellers(), 200, { 'cache-control': 'no-store' });
});
export const POST = (req: Request) => handle(async () => {
  const admin = requireAdmin(await auth());
  return json(await addSeller(await readJson(req), admin.email), 201);
});
```
`src/app/api/admin/sellers/[email]/route.ts`:

```ts
import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { removeSeller } from '@/lib/sellers';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ email: string }> };
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
export const DELETE = (_req: Request, { params }: Ctx) => handle(async () => {
  requireAdmin(await auth());
  await removeSeller(decode((await params).email));
  return json({ ok: true });
});
```

- [ ] **Step 5: UI.** `src/components/SellersAdmin.tsx` (follow `PostsAdmin` conventions: `Toast`, `.admin-row`/`.button` classes, required `span.lbl`; no inline banners):

```tsx
'use client';
import { useCallback, useState } from 'react';
import { Toast, type ToastState } from './Toast';
import type { SellerRow } from '@/lib/sellers';

const HEADERS = { 'content-type': 'application/json' };

export function SellersAdmin({ initialSellers }: { initialSellers: SellerRow[] }) {
  const [sellers, setSellers] = useState(initialSellers);
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (kind: 'success' | 'error', text: string) => setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function reload() {
    const r = await fetch('/api/admin/sellers', { cache: 'no-store' });
    if (r.ok) setSellers(await r.json()); else notify('error', 'Could not refresh the list.');
  }
  async function call(url: string, method: string, body?: unknown): Promise<string | null> {
    try {
      const r = await fetch(url, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
      if (r.ok) return null;
      return ((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Something went wrong. Please try again.';
    } catch { return 'Network error. Please try again.'; }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const err = await call('/api/admin/sellers', 'POST', { email: email.trim() });
    if (err) notify('error', err);
    else { setEmail(''); notify('success', `${email.trim().toLowerCase()} can now sell.`); await reload(); }
    setBusy(false);
  }
  async function remove(target: string) {
    setConfirming(null);
    const err = await call(`/api/admin/sellers/${encodeURIComponent(target)}`, 'DELETE');
    if (err) notify('error', err);
    else { notify('success', `Removed ${target}.`); await reload(); }
  }

  return (
    <section className="admin-posts">
      <div className="page-head">
        <h1>Sellers</h1>
        <p>Sellers can create, edit and archive their own products. Only admins publish them.</p>
      </div>
      <Toast toast={toast} onClose={closeToast} />
      <div className="admin-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <form className="admin-toolbar admin-form" onSubmit={add}>
            <label style={{ flex: 1, margin: 0 }}>
              <span className="lbl">Seller email (Google account)</span>
              <input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="seller@example.com" />
            </label>
            <button type="submit" className="button primary" disabled={busy} style={{ alignSelf: 'flex-end' }}>Add seller</button>
          </form>
          {sellers.length === 0 ? <div className="empty">No sellers yet.</div> : sellers.map(s => (
            <article key={s.email} className="admin-row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} data-testid="seller-row">
              <div className="admin-row-main">
                <h3>{s.email}</h3>
                <p>{s.products} {s.products === 1 ? 'product' : 'products'} · added {new Date(s.createdAt).toLocaleDateString('en-IN')} by {s.createdBy}</p>
              </div>
              {confirming === s.email ? (
                <div className="admin-confirm" role="group" aria-label={`Confirm remove ${s.email}`}>
                  <span>Remove {s.email}? Their products stay.</span>
                  <button type="button" className="button" onClick={() => setConfirming(null)}>Cancel</button>
                  <button type="button" className="button danger" onClick={() => remove(s.email)}>Yes, remove</button>
                </div>
              ) : (
                <div className="admin-row-actions">
                  <button type="button" className="button danger-outline" aria-label={`Remove ${s.email}`} onClick={() => setConfirming(s.email)}>Remove</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
```
`src/app/admin/users/page.tsx`:

```tsx
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SellersAdmin } from '@/components/SellersAdmin';
import { requireAdminPage } from '@/lib/admin-page';
import { listSellers } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  await requireAdminPage(); // admin only; sellers get a 404 here
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Admin', path: '/admin' }, { name: 'Sellers', path: '/admin/users' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <SellersAdmin initialSellers={await listSellers()} />
    </>
  );
}
```
`src/app/admin/layout.tsx` — show section tabs by role:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaffPage } from '@/lib/admin-page';

export const metadata: Metadata = { title: { absolute: 'Admin | Rang Rajasthan' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="admin-shell">
      <nav className="admin-tabs" aria-label="Admin sections">
        <Link href="/admin/posts">{user.role === 'admin' ? 'Artists’ posts' : 'My products'}</Link>
        {user.role === 'admin' && <Link href="/admin/users">Sellers</Link>}
      </nav>
      {children}
    </div>
  );
}
```
Append to `src/app/globals.css`: `.admin-tabs{display:flex;gap:10px;padding:18px 8.5% 0}.admin-tabs a{border:1px solid var(--control-border);border-radius:3px;padding:9px 13px;font:600 11px var(--font-sans),sans-serif;background:transparent}.admin-tabs a:hover{border-color:var(--green);color:var(--green)}` and `@media(max-width:700px){.admin-tabs{padding-left:5%;padding-right:5%}}`. Mention the tabs and `Toast`/required-marker rules already in the design skill; add a one-line "Admin section tabs" note to `.claude/skills/rang-rajasthan-design/SKILL.md`.

- [ ] **Step 6: Run to verify GREEN** — `npx vitest run tests/sellers.test.ts tests/sellers-api.test.ts tests/sellers-admin.test.tsx tests/breadcrumbs.test.tsx` (the breadcrumb guard must still pass: the new page has `<Breadcrumbs`), then the whole suite and `npx tsc --noEmit`. Mutation: remove the `roleFor(email) === 'admin'` check → the admin-email test FAILS; revert.

- [ ] **Step 7: Commit**
```bash
git add -A && git commit -m "feat: admin-managed sellers (API, /admin/users page, section tabs)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Role-aware posts UI (scoped page, no publish/delete for sellers)

**Files:**
- Modify: `src/app/admin/posts/page.tsx`, `src/components/PostsAdmin.tsx`, `src/components/PostForm.tsx`
- Modify (tests): `tests/posts-admin.test.tsx`, `tests/post-form.test.ts`, `tests/forms-required.test.tsx` (extend if the owner field is required-checked)

**Interfaces:**
- Consumes: Task 2 (`AdminProduct`, `scopeFor`, scoped reads), Task 1 (`requireStaffPage`).
- Produces: `<PostsAdmin initialProducts={AdminProduct[]} initialArtists role={'admin'|'seller'} />`; `<PostForm initial? artists role onSubmit onCancel />`; `buildPayload(f: FormData)` now includes `status` only when the form has a `status` field and `ownerEmail` only when the form has an `ownerEmail` field.

- [ ] **Step 1: Write failing tests.**
`tests/post-form.test.ts`: `buildPayload` omits `status` when the form has no status control and omits `ownerEmail` unless present; with both present they are included (`ownerEmail` trimmed). Update any existing expectation that assumed `status` is always present.
`tests/posts-admin.test.tsx` — change `mount` to `mount = (role: 'admin' | 'seller' = 'admin') => render(<PostsAdmin initialProducts={[...db]} initialArtists={artistsOf(db)} role={role} />)` and add:

```tsx
describe('PostsAdmin as a seller', () => {
  it('has no Delete buttons, a seller heading, and cannot choose Published', () => {
    mount('seller');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('My products');
    expect(screen.queryAllByRole('button', { name: /^Delete / })).toHaveLength(0);
    const sel = screen.getByLabelText('Change status for Draft Dish') as HTMLSelectElement; // a DRAFT row
    const published = Array.from(sel.options).find(o => o.value === 'APPROVED')!;
    expect(published.disabled).toBe(true);
    expect(Array.from(sel.options).filter(o => !o.disabled).map(o => o.value)).toEqual(['DRAFT', 'ARCHIVED']);
  });
  it('a published row still shows Published as its (disabled) current value and allows Draft/Archived', () => {
    mount('seller');
    const sel = screen.getByLabelText('Change status for Boat Charm') as HTMLSelectElement; // APPROVED row
    expect(sel.value).toBe('APPROVED');
    expect(Array.from(sel.options).filter(o => !o.disabled).map(o => o.value)).toEqual(['DRAFT', 'ARCHIVED']);
  });
  it('new-post form for a seller offers only Draft/Archived (default Draft) and no owner field', () => {
    mount('seller'); fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    const status = screen.getByLabelText(/^Status/) as HTMLSelectElement;
    expect(Array.from(status.options).map(o => o.value)).toEqual(['DRAFT', 'ARCHIVED']);
    expect(status.value).toBe('DRAFT');
    expect(screen.queryByLabelText(/Owner email/)).toBeNull();
  });
  it('editing a published post as a seller omits status from the PATCH and explains the re-review', async () => {
    mount('seller');
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
    expect(screen.queryByLabelText(/^Status/)).toBeNull();
    expect(screen.getByText(/back to Draft until an admin publishes it again/i)).toBeTruthy();
    fill(/^Title/, 'Boat Charm 2');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products/p2' && c[1]?.method === 'PATCH')!;
    expect(JSON.parse(call[1].body)).not.toHaveProperty('status');
  });
});

describe('PostsAdmin as an admin (owner info)', () => {
  it('shows the owner on rows, the Owner email field in the form, and keeps Delete and Published', () => {
    db = db.map(p => (p.id === 'p2' ? { ...p, ownerEmail: 'seller@x.co' } : p));
    mount('admin');
    expect(within(rowFor('Boat Charm')).getByText(/Owner: seller@x\.co/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Delete / }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    expect(screen.getByLabelText(/Owner email/)).toBeTruthy();
    const status = screen.getByLabelText(/^Status/) as HTMLSelectElement;
    expect(Array.from(status.options).map(o => o.value)).toEqual(['APPROVED', 'DRAFT', 'ARCHIVED']);
  });
  it('a 403 from the API (publish denied) shows a red toast and makes no GET calls', async () => {
    mount('seller');
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'PATCH' ? res(403, { error: 'Only an admin can publish a product.' }) : res(200, []));
    fireEvent.change(screen.getByLabelText('Change status for Draft Dish'), { target: { value: 'DRAFT' } }); // no-op, ignored
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```
(Existing admin tests keep working because `mount()` defaults to `admin`.) Add a page-level test file `tests/admin-posts-page.test.tsx` only if the page can be rendered with mocks cheaply; otherwise cover the page in Task 5's live check.

- [ ] **Step 2: Run to verify RED** — `npx vitest run tests/posts-admin.test.tsx tests/post-form.test.ts` → FAIL (`role` prop missing, options not restricted).

- [ ] **Step 3: Implement `PostForm.tsx`.**
`buildPayload` becomes:

```ts
export function buildPayload(f: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: text(f, 'name'), seller: text(f, 'seller'), description: text(f, 'description'),
    category: text(f, 'category'), city: text(f, 'city'),
    pricePaise: num(f, 'price', 100),
    stock: num(f, 'stock'),
    imageUrl: text(f, 'imageUrl'), artistName: text(f, 'artistName'), instagram: text(f, 'instagram'),
    youtube: text(f, 'youtube'), phone: text(f, 'phone'), email: text(f, 'email'),
  };
  // Only sent when the form shows the control: a seller editing a published post must not send a status.
  if (f.has('status')) payload.status = text(f, 'status');
  if (f.has('ownerEmail')) payload.ownerEmail = text(f, 'ownerEmail');
  return payload;
}
```
Props gain `role: 'admin' | 'seller'`; `initial?: AdminProduct`. Compute:

```tsx
const seller = role === 'seller';
const lockedStatus = seller && initial?.status === 'APPROVED';   // no status control at all
const statusOptions = seller
  ? [{ value: 'DRAFT', label: 'Draft (admin publishes after review)' }, { value: 'ARCHIVED', label: 'Archived' }]
  : [{ value: 'APPROVED', label: 'Published' }, { value: 'DRAFT', label: 'Draft (admin only)' }, { value: 'ARCHIVED', label: 'Archived' }];
```
Replace the Status `<label>` with:

```tsx
{!lockedStatus && (
  <label><span className="lbl">Status</span>
    <select name="status" required defaultValue={initial?.status && statusOptions.some(o => o.value === initial.status) ? initial.status : seller ? 'DRAFT' : 'APPROVED'}>
      {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
)}
```
and, when `lockedStatus`, render `<p className="form-note">This post is published. Saving changes sends it back to Draft until an admin publishes it again.</p>` just above the status row. For admins add (below the cover image field) `<label>Owner email<input name="ownerEmail" type="email" maxLength={254} defaultValue={initial?.ownerEmail ?? ''} placeholder="seller@example.com (optional)" /></label>` rendered only when `!seller`.

- [ ] **Step 4: Implement `PostsAdmin.tsx`.** Types: `Product` → `AdminProduct` for props/state. Add prop `role: 'admin' | 'seller'`; const `seller = role === 'seller'`. Changes:
  - Heading block: `seller ? <h1>My products</h1><p>Create and edit your own listings. An admin reviews and publishes them; archive anything you no longer sell.</p> : (existing text)`.
  - The row status select: `{POST_STATUSES.map(status => <option value={status.value} key={status.value} disabled={seller && status.value === 'APPROVED'}>{status.label}</option>)}`.
  - Delete button (and therefore the confirm group) is rendered only when `!seller`.
  - Row meta line: after the existing `<p>` add `{!seller && p.ownerEmail && <p className="muted">Owner: {p.ownerEmail}</p>}`.
  - Pass `role={role}` to `<PostForm …/>`.
  - For sellers the artist sidebar shows only their own artist names (data is already scoped); leave it.

- [ ] **Step 5: Implement `src/app/admin/posts/page.tsx`:**

```tsx
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { PostsAdmin } from '@/components/PostsAdmin';
import { requireStaffPage } from '@/lib/admin-page';
import { listArtists, listProductsForAdmin, scopeFor } from '@/lib/admin-posts';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  const user = await requireStaffPage(); // never rely on the layout alone
  const scope = scopeFor(user);
  const [products, artists] = await Promise.all([listProductsForAdmin({}, scope), listArtists(scope)]);
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: user.role === 'admin' ? 'Admin' : 'Seller', path: '/admin' },
    { name: user.role === 'admin' ? 'Artists’ posts' : 'My products', path: '/admin/posts' },
  ];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <PostsAdmin initialProducts={products} initialArtists={artists} role={user.role} />
    </>
  );
}
```
Update the design skill's "Controls"/"Toasts" notes only if behaviour changed (no).

- [ ] **Step 6: Run to verify GREEN** — `npx vitest run tests/posts-admin.test.tsx tests/post-form.test.ts tests/forms-required.test.tsx tests/breadcrumbs.test.tsx`, then the whole suite and `npx tsc --noEmit`. Expected: all pass.

- [ ] **Step 7: Commit**
```bash
git add -A && git commit -m "feat: role-aware posts UI (sellers cannot publish or delete; admins see owners)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Remove existing products, empty-catalog readiness, docs, live verification

**Files:**
- Modify: `data/db.json`, `scripts/seo-check.mjs`, `README.md`, `.claude/skills/rang-rajasthan-design/SKILL.md` (only if wording needs the role rules), `tests/pg-concurrency.test.ts` (add the seller race test)
- Live DB: apply migration `0003`, delete the existing products (user-authorised: "you can remove them from database").

**Interfaces:**
- Consumes: everything above; Docker Postgres.
- Produces: an app that works with zero products; `data/db.json` with `products: []` and `counters: { p: <highest id ever used>, w: 3 }` so ids are never reused if the DB is reset later.

- [ ] **Step 1: Back up, migrate, then delete the existing products** (destructive but explicitly requested; the backup makes it reversible):

```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
npm run db:up
BK="$TMPDIR/rr-backup-$(date +%s).sql"
docker compose exec -T db pg_dump -U rr -d rajasthan > "$BK" && ls -l "$BK"
npm run db:migrate 2>&1 | grep -E "applied|rror"
docker compose exec -T db psql -U rr -d rajasthan -c "select max(substring(id from 2)::int) as highest_p_id from products;"
docker compose exec -T db psql -U rr -d rajasthan -c "delete from products;" 
docker compose exec -T db psql -U rr -d rajasthan -tc "select count(*) from products; select * from id_counters order by 1;"
```
Expected: a non-empty backup file; `migrations applied successfully`; `count = 0`; `id_counters` still shows `p` ≥ the highest used id (never lowered, so the next product is not `p1`). Past orders keep their item history (no foreign key). Tell the user the backup path. If `id_counters.p` is lower than `highest_p_id`, stop and fix it (`update id_counters set value = <highest> where prefix='p'`) before continuing.

- [ ] **Step 2: Make `data/db.json` match.** Set `"products": []` and add `"counters": { "p": <highest_p_id>, "w": 3 }` (keep workshops, orders, bookings). Verify seeding is idempotent and counters survive: `npm run db:seed 2>&1 | tail -1` → `{ products: 0, workshops: 0, … }`; then `docker compose exec -T db psql -U rr -d rajasthan -c "select * from id_counters"` unchanged. Do **not** run `db:reset` (it would wipe seller assignments created later).

- [ ] **Step 3: Make `scripts/seo-check.mjs` independent of a specific product.** Replace the hard-coded product slug usage:

```js
const products = await (await fetch(BASE + '/api/products')).json();
const first = products[0];
const productPath = first ? `/products/${first.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${first.id}` : null;
if (!productPath) console.log('SKIP  product page checks (no published products yet)');
const pages = ['/', '/shop', '/workshops', '/cities/jaipur', '/workshops/beginner-crochet-make-your-first-flower-w1', ...(productPath ? [productPath] : [])];
```
and guard the dependent checks: the `prod` Product+Offer JSON-LD assertion and the `sitemap lists products` assertion run only `if (productPath)` (the sitemap check always asserts `/cities/udaipur`). Keep every other check, including the 404 probes. (If the slug helper in `src/lib/catalog-shared.ts` differs from the inline regex, import-free copy must match `productSlug`; verify with one real product in Step 5.)

- [ ] **Step 4: Add the concurrency test to `tests/pg-concurrency.test.ts`** (inside the existing `describe.skipIf`; uses the actors helper):

```ts
it('a seller content edit racing an admin publish never leaves unreviewed content published after the seller edit', async () => {
  const { admin, seller } = await import('./helpers/actors');
  const { updateProduct } = await import('@/lib/admin');
  for (let i = 0; i < 15; i++) {
    const p = await createProduct({ ...product, status: 'DRAFT', ownerEmail: seller.email }, admin);
    const [pub, edit] = await Promise.allSettled([updateProduct(p.id, { status: 'APPROVED' }, admin), updateProduct(p.id, { description: `edit ${i}` }, seller)]);
    expect(pub.status).toBe('fulfilled'); expect(edit.status).toBe('fulfilled');
    const [row] = await db.select().from(schema.products).where(eq(schema.products.id, p.id));
    expect(row.description).toBe(`edit ${i}`);
    expect(['APPROVED', 'DRAFT']).toContain(row.status);
    // seller edit ran after the publish => demoted; before => the admin published the edited text
  }
});
```
Run `npm run test:pg` → all pass (now 6).

- [ ] **Step 5: Live verification** (scratch server; never touch 3000):

```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
npx next build 2>&1 | grep -E "rror|Failed" ; echo "build exit: $?"      # Expected: no errors with ZERO products
(npx next start -p 3217 > $TMPDIR/s.log 2>&1 &) ; sleep 5
BASE_URL=http://localhost:3217 node scripts/seo-check.mjs | grep -E "^FAIL|SKIP|checks passed|failed"   # Expected: SKIP line, "All SEO checks passed"
# mint tokens (script inside the repo, deleted after): admin = first ADMIN_EMAILS entry, seller = seller@example.test, buyer = buyer@example.test
```
Then with the forged cookies (`next-auth.session-token=…`; NEXTAUTH_URL for the token script may differ — only the secret matters):
  1. Admin `POST /api/admin/sellers {"email":"seller@example.test"}` → 201; again → 409; `GET /api/admin/sellers` as seller → 403, as buyer → 403, anonymous → 401.
  2. Seller `POST /api/products` (valid body, no status) → 201 `DRAFT`, `ownerEmail":"seller@example.test"`; with `"status":"APPROVED"` → 403; public `GET /api/products` → `[]`; `/shop` has no product text.
  3. Seller `GET /api/admin/products` → only own; admin `POST /api/products` (published, owner = admin) then seller `GET /api/admin/products/<that id>` → 404 and `PATCH` → 404.
  4. Seller `PATCH` own `{"status":"APPROVED"}` → 403; `{"status":"ARCHIVED"}` → 200; `{"status":"DRAFT"}` → 200; `DELETE` → 403.
  5. Admin `PATCH {"status":"APPROVED"}` → 200 → product appears in public API and `/products/<slug>` is 200 and its HTML/JSON-LD/sitemap contain **no** seller email; seller then `PATCH {"stock":9}` → 200 and the product is `DRAFT` and disappears from the public API.
  6. Buyer: `POST /api/products` → 403, `PATCH` → 403, `GET /api/products` → 200; buyer `POST /api/orders` still works for a published product.
  7. Admin `DELETE /api/admin/sellers/seller%40example.test` → 200; the same seller cookie now gets 403 on `POST /api/products` **without re-login** (role re-resolved per request); the seller's product still exists for admin.
  8. HTML gates: with the seller cookie `GET /admin/posts` → 200 with "My products" and a breadcrumb, `GET /admin/users` → 404; with the admin cookie `/admin/users` → 200; anonymous `/admin/users` → 307 to sign-in.
  9. DB role lookup failure: `docker compose stop db`, call `GET /api/products` with the seller cookie (public route → 500 is fine) and `POST /api/products` → 500/403 but **never** 201; restart the db and confirm recovery.
Clean up: `pkill -f "next start -p 3217"`, delete the token script, remove test products/sellers created during the checks (`delete from products where owner_email like '%@example.test' or seller = 'Live Test'`; `delete from user_roles`), leaving the DB with **zero products**. Record any deviation in the ledger; a seller `201` with `APPROVED` or a cross-seller `200` is a blocking bug.

- [ ] **Step 6: Docs.** README: add a "Roles" section — table of customer / seller / admin abilities (buyer: read + demo checkout; seller: create/read/edit/archive own products, never publish or delete, edits to a published product return it to Draft; admin: everything, publishes, deletes, manages sellers at `/admin/users`, assigns owners), how admins are defined (`ADMIN_EMAILS`) vs sellers (DB, UI), that role changes apply on the next request, and that sellers and admins share `/admin/posts` (scoped). Update the API table: staff routes (`POST /api/products`, `PATCH /api/products/:id`, `GET /api/admin/products*`, `GET /api/admin/artists`) → "admin or seller (sellers: own products only)"; `DELETE /api/products/:id`, workshop writes, `/api/admin/summary`, `/api/admin/sellers*` → admin only; note `403 {"error":"Seller or admin access required."}`. Update the "Admin: artists' posts" section and the DB section (new `user_roles` table, `products.owner_email`; `db:reset` also clears seller assignments). Note that `data/db.json` now has no products.

- [ ] **Step 7: Final checks and commit**
```bash
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
npx vitest run --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000 2>&1 | grep -E "Tests |Test Files|×"
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "^\.next/dev"
git status --short
git add -A && git commit -m "feat: remove seed products, empty-catalog ready seo-check, seller docs and race test

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Expected: all tests pass (pg suite skipped), no type errors.

---

## Self-Review

**Spec coverage:** seller creates/reads/edits/archives own products (Task 2 service + routes, Task 4 UI) · cannot publish (Task 2 `PUBLISH_DENIED` on create/patch/transition, edit-published → Draft; Task 4 UI hides Published; Task 5 live checks) · only admin publishes (Task 2; admin PATCH test) · buyers read-only (customers get 403 on staff routes, Task 2 route tests; public reads unchanged; Task 5 step 5.6) · admin assigns sellers in UI (Task 3 API + `/admin/users`) · same `/admin/posts` page scoped (Task 4) · existing products removed (Task 5 steps 1–2, with backup and counters kept) · session role resolved from DB per request, fail closed (Task 1).

**Placeholder scan:** no TBD/TODO. Task 5 Step 2 has `<highest_p_id>` as a value the engineer reads from the preceding SQL output (the command that prints it is in Step 1); Task 3's UI test descriptions are specified behaviour-by-behaviour with the exact fixtures/URLs.

**Type consistency:** `Actor` (authz.ts) is what `createProduct/updateProduct` take and what `actorOf(StaffUser)` returns; `scopeFor({email, role})` takes a `StaffUser`/`SessionUser`; `AdminProduct` is returned by `toAdminProduct`, `createProduct/updateProduct`, the admin reads, and consumed by `PostsAdmin/PostForm`; `requireStaffPage()` returns `StaffUser` used for `scopeFor` and the `role` prop; `userRoles` columns (`email`, `role`, `createdAt`, `createdBy`) are the same in schema, `roles.ts`, `sellers.ts` and tests; `SellerRow` is shared by `sellers.ts`, the routes and `SellersAdmin`.

**Review Focus coverage:** (1) Task 2 "cross-seller isolation" tests + route 404 tests; (2) Task 2 create/patch/edit-published tests including status case variants and `ownerEmail` injection; (3) Task 1 `resolveRole` tests (fail-closed, env wins) + Task 3 add/remove tests + Task 5 step 5.7/5.9; (4) Task 2 leakage test + Task 3 sellers API 401/403 tests + Task 5 step 5.5; (5) Task 5 steps 3 and 5 (build + seo-check with zero products).

**Known limits / decisions to confirm:**
(a) Buyers keep demo checkout (orders/bookings) — I read "Buyers have only Read access" as "read-only for products"; say if you want checkout disabled too.
(b) Sellers cannot touch workshops (not requested); admin-only as before.
(c) A seller's no-op save of a published product keeps it published (no real content change), any real change demotes it to Draft.
(d) Removing a seller keeps their products (owned by that email, now admin-managed); the seller's existing session stops working for staff routes on the next request.
(e) Products created by an admin are owned by that admin unless an owner is assigned; products with no owner are visible to admins only.
(f) The role lookup adds one indexed DB read per session access; if the DB is unreachable a seller temporarily acts as a customer (fail closed).
(g) `db:reset` now also clears seller assignments (documented).
(h) Deleting the 5 existing products is irreversible except via the `pg_dump` backup the plan takes first.
