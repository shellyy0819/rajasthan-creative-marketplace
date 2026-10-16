import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { resolveAccess, resolveRole, upsertUserOnSignIn } from '@/lib/roles';
import { asRole, requireStaff, requireUser, actorOf, roleFor } from '@/lib/authz';
import { adminGate, staffGate } from '@/lib/admin-gate';
import { authOptions } from '@/auth';
import { setDb } from '@/db/client';
import { ROLE_ID, ensureUser, grantRole } from '@/db/people';
import { userRoles, users } from '@/db/schema';
import { getTestDb, giveRole, resetTestDb } from './helpers/testdb';

const origAdmins = process.env.ADMIN_EMAILS;
beforeEach(async () => { process.env.ADMIN_EMAILS = 'boss@shop.com'; await resetTestDb(); });
afterEach(() => { process.env.ADMIN_EMAILS = origAdmins; });

describe('resolveAccess (users and roles are many-to-many)', () => {
  it('no row or no roles is a customer; seller row is a seller; admin row is an admin; email is case-insensitive', async () => {
    expect(await resolveAccess('nobody@x.co')).toEqual({ role: 'customer', active: true });
    await giveRole('plain@x.co', 'customer');
    expect((await resolveAccess('plain@x.co')).role).toBe('customer');
    await giveRole('s@x.co', 'seller');
    await giveRole('a@x.co', 'admin');
    expect((await resolveAccess('S@X.co')).role).toBe('seller');
    expect((await resolveAccess('A@x.CO')).role).toBe('admin');
  });
  it('a user holding both roles resolves to the highest (admin)', async () => {
    const u = await giveRole('both@x.co', 'seller');
    await grantRole(await getTestDb(), u.id, 'admin');
    expect((await resolveAccess('both@x.co')).role).toBe('admin');
  });
  it('ADMIN_EMAILS is the bootstrap admin even with no row, and cannot be deactivated away', async () => {
    expect(await resolveAccess('Boss@Shop.com')).toEqual({ role: 'admin', active: true });
    const u = await ensureUser(await getTestDb(), 'boss@shop.com');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, u.id));
    expect(await resolveAccess('boss@shop.com')).toEqual({ role: 'admin', active: true });
  });
  it('a deactivated user is a customer with active=false, whatever roles they hold', async () => {
    const u = await giveRole('s@x.co', 'seller');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, u.id));
    expect(await resolveAccess('s@x.co')).toEqual({ role: 'customer', active: false });
  });
  it('role changes apply on the very next lookup', async () => {
    const u = await giveRole('s@x.co', 'seller');
    expect(await resolveRole('s@x.co')).toBe('seller');
    await (await getTestDb()).delete(userRoles).where(eq(userRoles.userId, u.id));
    expect(await resolveRole('s@x.co')).toBe('customer');
  });
  it('fails closed to customer when the database errors; env admin never needs the DB', async () => {
    setDb({ select() { throw new Error('db down'); } } as never);
    expect((await resolveAccess('s@x.co')).role).toBe('customer');
    expect((await resolveAccess('boss@shop.com')).role).toBe('admin');
  });
});

describe('upsertUserOnSignIn', () => {
  it('creates a role-less customer with name and Google id, and is idempotent', async () => {
    expect(await upsertUserOnSignIn({ email: 'New@X.co', name: 'New Person', sub: 'g-1' })).toEqual({ active: true });
    await upsertUserOnSignIn({ email: 'new@x.co', name: 'New Person', sub: 'g-1' });
    const db = await getTestDb();
    const rows = await db.select().from(users).where(eq(users.email, 'new@x.co'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'New Person', googleSub: 'g-1', active: true });
    expect(await db.select().from(userRoles).where(eq(userRoles.userId, rows[0].id))).toHaveLength(0);
  });
  it('fills google_sub once (never overwritten) and refreshes the name; an admin-pre-created user keeps their roles', async () => {
    const pre = await giveRole('pre@x.co', 'seller');
    await upsertUserOnSignIn({ email: 'PRE@x.co', name: 'Pre Seller', sub: 'g-A' });
    await upsertUserOnSignIn({ email: 'pre@x.co', name: 'Renamed', sub: 'g-B' });
    const [row] = await (await getTestDb()).select().from(users).where(eq(users.id, pre.id));
    expect(row).toMatchObject({ googleSub: 'g-A', name: 'Renamed' });
    expect((await resolveAccess('pre@x.co')).role).toBe('seller');
  });
  it('bootstrap admins get an admin row; deactivated users are reported inactive', async () => {
    await upsertUserOnSignIn({ email: 'boss@shop.com', name: 'Boss', sub: 'g-0' });
    const db = await getTestDb();
    const [u] = await db.select().from(users).where(eq(users.email, 'boss@shop.com'));
    expect((await db.select().from(userRoles).where(eq(userRoles.userId, u.id))).map(r => r.roleId)).toEqual([ROLE_ID.admin]);
    const x = await giveRole('off@x.co', 'customer');
    await db.update(users).set({ active: false }).where(eq(users.id, x.id));
    expect(await upsertUserOnSignIn({ email: 'off@x.co', name: 'Off', sub: 'g-9' })).toEqual({ active: false });
  });
});

describe('NextAuth callbacks', () => {
  it('signIn: only verified Google emails; creates the user; refuses deactivated users; fails closed on DB errors', async () => {
    const signIn = authOptions.callbacks!.signIn!;
    const ok = { account: { provider: 'google', providerAccountId: 'acc-1' }, profile: { email: 'v@x.co', email_verified: true, name: 'V', sub: 'sub-1' } } as never;
    expect(await signIn(ok)).toBe(true);
    expect(await signIn({ ...(ok as object), profile: { email: 'v@x.co', email_verified: false } } as never)).toBe(false);
    expect(await signIn({ ...(ok as object), account: { provider: 'github' } } as never)).toBe(false);
    expect(await signIn({ ...(ok as object), profile: { email_verified: true } } as never)).toBe(false);
    const [u] = await (await getTestDb()).select().from(users).where(eq(users.email, 'v@x.co'));
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, u.id));
    expect(await signIn(ok)).toBe(false);
    setDb({ transaction() { throw new Error('db down'); } } as never);
    expect(await signIn({ ...(ok as object), profile: { email: 'z@x.co', email_verified: true } } as never)).toBe(false);
  });
  it('jwt puts the resolved role and active flag in the token; session exposes only known roles', async () => {
    await giveRole('seller@x.co', 'seller');
    const t = await authOptions.callbacks!.jwt!({ token: { email: 'seller@x.co' } } as never);
    expect(t).toMatchObject({ role: 'seller', active: true });
    const s = await authOptions.callbacks!.session!({ session: { user: { email: 'x' } }, token: { role: 'god', active: false } } as never);
    expect((s as { user: { role: string; active: boolean } }).user).toMatchObject({ role: 'customer', active: false });
  });
});

describe('authz helpers and gates', () => {
  it('asRole accepts only the three roles', () => {
    expect([asRole('admin'), asRole('seller'), asRole('customer'), asRole('SELLER'), asRole(undefined), asRole({})]).toEqual(['admin', 'seller', 'customer', 'customer', 'customer', 'customer']);
  });
  it('requireUser rejects deactivated sessions with 403', () => {
    expect(() => requireUser({ user: { email: 'a@x.co', role: 'seller', active: false } })).toThrowError(expect.objectContaining({ status: 403, message: 'Account is deactivated.' }));
  });
  it('requireStaff: 401 anonymous, 403 customer, ok for seller/admin; actorOf keeps email and role', () => {
    expect(() => requireStaff(null)).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => requireStaff({ user: { email: 'c@x.co', role: 'customer' } })).toThrowError(expect.objectContaining({ status: 403, message: 'Seller or admin access required.' }));
    expect(requireStaff({ user: { email: 's@x.co', role: 'seller' } }).role).toBe('seller');
    expect(actorOf(requireStaff({ user: { email: 'a@x.co', role: 'admin' } }))).toEqual({ email: 'a@x.co', role: 'admin' });
  });
  it('roleFor only knows env admins', () => {
    expect(roleFor('A@x.co', 'a@x.co')).toBe('admin');
    expect(roleFor('b@x.co', 'a@x.co')).toBe('customer');
  });
  it('staffGate/adminGate: signin / forbidden / ok, and deactivated sessions are forbidden', () => {
    expect(staffGate(null)).toBe('signin');
    expect(staffGate({ user: { email: 'c@x.co', role: 'customer' } })).toBe('forbidden');
    expect(staffGate({ user: { email: 's@x.co', role: 'seller' } })).toBe('ok');
    expect(staffGate({ user: { email: 'a@x.co', role: 'admin' } })).toBe('ok');
    expect(staffGate({ user: { email: 's@x.co', role: 'seller', active: false } })).toBe('forbidden');
    expect(adminGate({ user: { email: 's@x.co', role: 'seller' } })).toBe('forbidden');
    expect(adminGate({ user: { email: 'a@x.co', role: 'admin', active: false } })).toBe('forbidden');
  });
});
