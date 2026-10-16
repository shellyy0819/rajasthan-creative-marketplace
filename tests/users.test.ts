import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createUser, deleteUser, getProfileByEmail, listUsers, saveProfile, updateUser } from '@/lib/users';
import { createProduct, createWorkshop } from '@/lib/admin';
import { createOrder } from '@/lib/orders';
import { resolveRole } from '@/lib/roles';
import { sellerProfiles, userRoles, users } from '@/db/schema';
import { admin } from './helpers/actors';
import { getTestDb, giveRole, makeSeller, resetTestDb } from './helpers/testdb';

const origAdmins = process.env.ADMIN_EMAILS;
beforeEach(async () => { process.env.ADMIN_EMAILS = ''; await resetTestDb(); await giveRole(admin.email, 'admin'); });
afterEach(() => { process.env.ADMIN_EMAILS = origAdmins; });
const base = { name: 'N', category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1 };
const byEmail = async (email: string) => (await listUsers()).find(u => u.email === email)!;

describe('createUser', () => {
  it('creates a user with roles (many-to-many), lower-cased email, a seller profile for sellers; role applies at once', async () => {
    const u = await createUser({ email: '  New.Seller@X.co ', name: 'New Seller', roles: ['seller'] }, admin.email);
    expect(u).toMatchObject({ email: 'new.seller@x.co', name: 'New Seller', active: true, roles: ['seller'], products: 0 });
    expect(await resolveRole('NEW.seller@x.co')).toBe('seller');
    expect((await getProfileByEmail('new.seller@x.co')).displayName).toBe('New Seller');
    const both = await createUser({ email: 'both@x.co', roles: ['seller', 'admin', 'seller'] }, admin.email);
    expect(both.roles).toEqual(['admin', 'seller']);
    expect(await resolveRole('both@x.co')).toBe('admin');
  });
  it('a user can be created with no roles (a plain customer) and the name defaults from the email', async () => {
    expect(await createUser({ email: 'buyer@x.co' }, admin.email)).toMatchObject({ name: 'buyer', roles: [] });
  });
  it('rejects bad input, unknown roles, and duplicates (409, case-insensitive)', async () => {
    for (const email of ['', 'nope', 'a@b', 'a b@c.co', 'x'.repeat(260) + '@x.co', 5, null]) await expect(createUser({ email }, admin.email)).rejects.toMatchObject({ status: 400 });
    for (const roles of [['customer'], ['root'], 'seller', [1]]) await expect(createUser({ email: 'r@x.co', roles }, admin.email)).rejects.toMatchObject({ status: 400 });
    await expect(createUser(null, admin.email)).rejects.toMatchObject({ status: 400 });
    await createUser({ email: 'dup@x.co' }, admin.email);
    await expect(createUser({ email: 'DUP@x.co' }, admin.email)).rejects.toMatchObject({ status: 409, message: 'User already exists.' });
  });
});

describe('updateUser', () => {
  it('replaces the role set (many-to-many), records who assigned it, and keeps the seller profile', async () => {
    const u = await createUser({ email: 's@x.co', roles: ['seller'] }, admin.email);
    const both = await updateUser(u.id, { roles: ['seller', 'admin'] }, admin.email);
    expect(both.roles).toEqual(['admin', 'seller']);
    const db = await getTestDb();
    const rows = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.assignedBy)).toBe(true);
    expect((await updateUser(u.id, { roles: [] }, admin.email)).roles).toEqual([]);
    expect(await resolveRole('s@x.co')).toBe('customer');
    expect(await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, u.id))).toHaveLength(1);
  });
  it('activates/deactivates and renames; unknown id is 404; bad types are 400', async () => {
    const u = await createUser({ email: 's@x.co', roles: ['seller'] }, admin.email);
    expect(await updateUser(u.id, { active: false, name: 'Renamed' }, admin.email)).toMatchObject({ active: false, name: 'Renamed' });
    expect((await updateUser(u.id, { active: true }, admin.email)).active).toBe(true);
    await expect(updateUser(u.id, { active: 'no' }, admin.email)).rejects.toMatchObject({ status: 400 });
    await expect(updateUser('00000000-0000-0000-0000-000000000000', { active: false }, admin.email)).rejects.toMatchObject({ status: 404 });
  });
  it('an admin cannot deactivate themselves or drop their own admin role', async () => {
    const me = await byEmail(admin.email);
    await expect(updateUser(me.id, { active: false }, admin.email)).rejects.toMatchObject({ status: 409 });
    await expect(updateUser(me.id, { roles: ['seller'] }, admin.email)).rejects.toMatchObject({ status: 409 });
    expect((await updateUser(me.id, { roles: ['admin', 'seller'] }, admin.email)).roles).toEqual(['admin', 'seller']);
  });
  it('the last active admin cannot be demoted or deactivated by another admin (no ADMIN_EMAILS fallback)', async () => {
    const other = await createUser({ email: 'second@x.co', roles: ['admin'] }, admin.email);
    const me = await byEmail(admin.email);
    await updateUser(other.id, { active: false }, admin.email); // `me` is still an admin
    await expect(updateUser(other.id, { roles: [] }, me.email)).resolves.toBeDefined(); // already inactive: does not lower the active count
    await updateUser(other.id, { active: true, roles: ['admin'] }, admin.email);
    await updateUser(me.id, {}, other.email); // no-op is fine
    await expect(updateUser(me.id, { active: false }, other.email)).resolves.toBeDefined(); // `other` remains active admin
    await expect(updateUser(other.id, { active: false }, me.email)).rejects.toMatchObject({ status: 409, message: 'At least one active admin is required.' });
  });
  it('bootstrap ADMIN_EMAILS admins count as admins for the last-admin rule', async () => {
    process.env.ADMIN_EMAILS = 'env@x.co';
    const me = await byEmail(admin.email);
    const other = await createUser({ email: 'second@x.co', roles: ['admin'] }, 'env@x.co');
    expect((await updateUser(me.id, { active: false }, other.email)).active).toBe(false); // env admin keeps the system administered
  });
});

describe('deleteUser (admin only; blocked when the user owns anything)', () => {
  it('deletes a user who owns nothing, with their roles and profile', async () => {
    const u = await createUser({ email: 's@x.co', roles: ['seller'] }, admin.email);
    await deleteUser(u.id, admin.email);
    expect(await listUsers().then(l => l.some(x => x.id === u.id))).toBe(false);
    expect(await (await getTestDb()).select().from(userRoles).where(eq(userRoles.userId, u.id))).toHaveLength(0);
    expect(await (await getTestDb()).select().from(sellerProfiles).where(eq(sellerProfiles.userId, u.id))).toHaveLength(0);
  });
  it('409 with a "deactivate instead" message when the user has products, workshops, orders or bookings', async () => {
    const s = await makeSeller('s@x.co', 'S');
    await createProduct(base, s.actor);
    await expect(deleteUser(s.id, admin.email)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Deactivate them instead') });
    const host = await createUser({ email: 'host@x.co', roles: ['seller'] }, admin.email);
    const w = await createWorkshop({ title: 'T', type: 'FREE', pricePaise: 0, city: 'Jaipur', venue: 'V', date: '2026-12-01', time: '10:00', seats: 5, host: 'H', hostId: host.id, description: 'D' });
    expect(w.hostId).toBe(host.id);
    await expect(deleteUser(host.id, admin.email)).rejects.toMatchObject({ status: 409 });
    const buyer = await createUser({ email: 'buyer@x.co' }, admin.email);
    await createOrder({ items: [{ productId: 'p1', quantity: 1 }] }, 'buyer@x.co');
    await expect(deleteUser(buyer.id, admin.email)).rejects.toMatchObject({ status: 409 });
    expect((await byEmail('buyer@x.co')).orders).toBe(1);
  });
  it('cannot delete yourself, unknown ids are 404, and the last admin cannot be deleted', async () => {
    const me = await byEmail(admin.email);
    await expect(deleteUser(me.id, admin.email)).rejects.toMatchObject({ status: 409 });
    await expect(deleteUser('00000000-0000-0000-0000-000000000000', admin.email)).rejects.toMatchObject({ status: 404 });
    const other = await createUser({ email: 'second@x.co', roles: ['admin'] }, admin.email);
    await updateUser(me.id, { roles: ['seller'] }, other.email).catch(() => undefined);
    await expect(deleteUser(other.id, me.email)).rejects.toMatchObject({ status: 409 });
  });
});

describe('seller profiles (public name and contact)', () => {
  it('saves, trims, normalises the phone, and blank optional fields clear to nothing', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const saved = await saveProfile(s.id, { displayName: ' Shauk & Co ', publicPhone: '+91 99898 98999', publicEmail: 'hi@shauk.co', instagram: 'shauk', youtube: '@shauk' });
    expect(saved).toEqual({ userId: s.id, displayName: 'Shauk & Co', publicPhone: '+919989898999', publicEmail: 'hi@shauk.co', instagram: 'shauk', youtube: '@shauk' });
    const cleared = await saveProfile(s.id, { displayName: 'Shauk & Co', publicPhone: '', publicEmail: '  ', instagram: '', youtube: '' });
    expect(cleared).toEqual({ userId: s.id, displayName: 'Shauk & Co' });
    expect(JSON.stringify(cleared)).not.toContain('null');
  });
  it('validates: name required, phone format, email format, lengths', async () => {
    const s = await makeSeller('s@x.co', 'S');
    for (const bad of [{ displayName: '' }, { displayName: 'x'.repeat(101) }, { displayName: 'A', publicPhone: '12345' }, { displayName: 'A', publicPhone: '5989898999' }, { displayName: 'A', publicEmail: 'nope' }, { displayName: 'A', instagram: 'x'.repeat(201) }, null, []])
      await expect(saveProfile(s.id, bad)).rejects.toMatchObject({ status: 400 });
  });
  it('only sellers/admins have profiles; unknown user is 404; profile name shows on their products', async () => {
    const buyer = await giveRole('buyer@x.co', 'customer');
    await expect(saveProfile(buyer.id, { displayName: 'X' })).rejects.toMatchObject({ status: 400, message: 'That user is not a seller.' });
    await expect(saveProfile('00000000-0000-0000-0000-000000000000', { displayName: 'X' })).rejects.toMatchObject({ status: 404 });
    const s = await makeSeller('s@x.co', 'Old Name');
    const p = await createProduct(base, s.actor);
    await saveProfile(s.id, { displayName: 'New Name', instagram: 'newname' });
    const { getProductForAdmin } = await import('@/lib/admin-posts');
    expect(await getProductForAdmin(p.id)).toMatchObject({ seller: 'New Name', instagram: 'newname' });
  });
  it('getProfileByEmail falls back to the user name when no profile exists yet', async () => {
    const p = await getProfileByEmail('fresh@x.co');
    expect(p).toMatchObject({ displayName: 'fresh' });
    expect((await (await getTestDb()).select().from(users).where(eq(users.email, 'fresh@x.co')))).toHaveLength(1);
  });
});

describe('bootstrap (ADMIN_EMAILS) admins are protected', () => {
  it('cannot be deactivated or lose the admin role, even by another admin', async () => {
    process.env.ADMIN_EMAILS = 'boot@x.co';
    const boot = await createUser({ email: 'boot@x.co', roles: ['admin'] }, admin.email);
    await expect(updateUser(boot.id, { active: false }, admin.email)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('ADMIN_EMAILS') });
    await expect(updateUser(boot.id, { roles: ['seller'] }, admin.email)).rejects.toMatchObject({ status: 409 });
    await expect(updateUser(boot.id, { roles: [] }, admin.email)).rejects.toMatchObject({ status: 409 });
    expect((await updateUser(boot.id, { roles: ['admin', 'seller'] }, admin.email)).roles).toEqual(['admin', 'seller']);
    await expect(deleteUser(boot.id, admin.email)).resolves.toBeUndefined(); // owns nothing: deleting the row is harmless, they re-create at sign-in
  });
});
