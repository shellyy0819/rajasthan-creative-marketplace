import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createUser, deleteUser, getProfileByEmail, listUsers, saveProfile, updateUser } from '@/lib/users';
import { createProduct, createWorkshop } from '@/lib/admin';
import { createOrder } from '@/lib/orders';
import { resolveAccess, resolveRole, upsertUserOnSignIn } from '@/lib/roles';
import { listOrders } from '@/lib/orders';
import { orders, products, sellerProfiles, userArchive, userRoles, users } from '@/db/schema';
import { admin } from './helpers/actors';
import { getTestDb, giveRole, makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { categories } from '@/db/schema';

const origAdmins = process.env.ADMIN_EMAILS;
beforeEach(async () => { process.env.ADMIN_EMAILS = ''; await resetTestDb(); await giveRole(admin.email, 'admin'); });
afterEach(() => { process.env.ADMIN_EMAILS = origAdmins; });
const base = { name: 'N', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1 };
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

describe('deleteUser (soft delete: the row is kept, marked deleted and deactivated)', () => {
  it('hides the user from the list, keeps the row and all their data, and deactivates them', async () => {
    const u = await createUser({ email: 's@x.co', roles: ['seller'] }, admin.email);
    await deleteUser(u.id, admin.email);
    expect(await listUsers().then(l => l.some(x => x.id === u.id))).toBe(false);
    const [row] = await (await getTestDb()).select().from(users).where(eq(users.id, u.id));
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(row.active).toBe(false);
    expect(await (await getTestDb()).select().from(userRoles).where(eq(userRoles.userId, u.id))).toHaveLength(1);
    expect(await (await getTestDb()).select().from(sellerProfiles).where(eq(sellerProfiles.userId, u.id))).toHaveLength(1);
    expect(await resolveAccess('s@x.co')).toMatchObject({ gone: true }); // no live user any more: the session ends
  });
  it('works for users who own products, workshops, orders or bookings, and keeps that data linked', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const p = await createProduct(base, s.actor);
    await deleteUser(s.id, admin.email);
    const [prod] = await (await getTestDb()).select().from(products).where(eq(products.id, p.id));
    expect(prod.sellerId).toBe(s.id);
    const buyer = await createUser({ email: 'buyer@x.co' }, admin.email);
    await createOrder({ items: [{ productId: 'p1', quantity: 1 }] }, 'buyer@x.co');
    await deleteUser(buyer.id, admin.email);
    expect(await (await getTestDb()).select().from(orders).where(eq(orders.userId, buyer.id))).toHaveLength(1);
  });
  it('hides the deleted seller\'s live products (APPROVED -> ARCHIVED), leaves drafts and other sellers\' products alone', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const other = await makeSeller('o@x.co', 'O');
    const live = await createProduct({ ...base, status: 'APPROVED' }, admin);
    const db = await getTestDb();
    await db.update(products).set({ sellerId: s.id }).where(eq(products.id, live.id));
    const draft = await createProduct(base, s.actor);
    const theirs = await createProduct({ ...base, status: 'APPROVED' }, admin);
    await db.update(products).set({ sellerId: other.id }).where(eq(products.id, theirs.id));
    await deleteUser(s.id, admin.email);
    const st = async (id: string) => (await db.select().from(products).where(eq(products.id, id)))[0].status;
    expect(await st(live.id)).toBe('ARCHIVED');
    expect(await st(draft.id)).toBe('DRAFT');
    expect(await st(theirs.id)).toBe('APPROVED');
  });
  it('a deleted user can no longer be edited (404) or deleted twice (404)', async () => {
    const u = await createUser({ email: 'gone@x.co' }, admin.email);
    await deleteUser(u.id, admin.email);
    await expect(updateUser(u.id, { active: true }, admin.email)).rejects.toMatchObject({ status: 404 });
    await expect(deleteUser(u.id, admin.email)).rejects.toMatchObject({ status: 404 });
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

describe('backup and re-registration', () => {
  it('delete writes a backup (user, roles, profile, products with status, Google id) and frees the email and Google id', async () => {
    const s = await makeSeller('s@x.co', 'S');
    await (await getTestDb()).update(users).set({ googleSub: 'g-old' }).where(eq(users.id, s.id));
    const p = await createProduct(base, s.actor);
    await deleteUser(s.id, admin.email);
    const [a] = await (await getTestDb()).select().from(userArchive).where(eq(userArchive.userId, s.id));
    expect(a).toMatchObject({ email: 's@x.co', googleSub: 'g-old', reason: 'deleted' });
    const snap = a.snapshot as any;
    expect(snap.user.id).toBe(s.id);
    expect(snap.roles).toHaveLength(1);
    expect(snap.sellerProfile.userId).toBe(s.id);
    expect(snap.products).toEqual([{ id: p.id, status: 'DRAFT' }]);
    const [row] = await (await getTestDb()).select().from(users).where(eq(users.id, s.id));
    expect(row.googleSub).toBeNull();
  });
  it('deactivating writes a backup once (not when already inactive); reactivating writes none', async () => {
    const u = await createUser({ email: 'd@x.co', roles: ['seller'] }, admin.email);
    await updateUser(u.id, { active: false }, admin.email);
    await updateUser(u.id, { active: false }, admin.email);
    await updateUser(u.id, { active: true }, admin.email);
    const rows = await (await getTestDb()).select().from(userArchive).where(eq(userArchive.userId, u.id));
    expect(rows.map(r => r.reason)).toEqual(['deactivated']);
  });
  it('a deleted person signs in again as a brand-new user: new id, no roles, none of the old orders or products', async () => {
    const old = await createUser({ email: 'again@x.co', roles: ['seller'] }, admin.email);
    await (await getTestDb()).update(users).set({ googleSub: 'g-1' }).where(eq(users.id, old.id));
    await createOrder({ items: [{ productId: 'p1', quantity: 1 }] }, 'again@x.co');
    await deleteUser(old.id, admin.email);
    expect(await upsertUserOnSignIn({ email: 'Again@X.co', name: 'Again', sub: 'g-1' })).toEqual({ active: true });
    const fresh = await byEmail('again@x.co');
    expect(fresh.id).not.toBe(old.id);
    expect(fresh.roles).toEqual([]);
    expect((await resolveAccess('again@x.co'))).toEqual({ role: 'customer', active: true });
    expect(await listOrders({ email: 'again@x.co', role: 'customer' })).toHaveLength(0);
    expect((await (await getTestDb()).select().from(users).where(eq(users.id, old.id)))[0].deletedAt).not.toBeNull(); // old row untouched
  });
  it('a deleted user is "gone" for session checks; a deactivated one is not', async () => {
    const d = await createUser({ email: 'del@x.co' }, admin.email);
    const off = await createUser({ email: 'off@x.co' }, admin.email);
    await deleteUser(d.id, admin.email);
    await updateUser(off.id, { active: false }, admin.email);
    expect(await resolveAccess('del@x.co')).toMatchObject({ gone: true });
    expect(await resolveAccess('off@x.co')).toEqual({ role: 'customer', active: false });
  });
});

describe('seller profiles (public name and contact)', () => {
  it('saves, trims, normalises the phone, and blank optional fields clear to nothing', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const saved = await saveProfile(s.id, { displayName: ' Shauk & Co ', publicPhone: '+91 99898 98999', publicEmail: 'hi@shauk.co', instagram: 'shauk', youtube: '@shauk' });
    // A seller's public email is always their registration email, whatever is sent.
    expect(saved).toEqual({ userId: s.id, displayName: 'Shauk & Co', publicPhone: '+919989898999', publicEmail: 's@x.co', instagram: 'shauk', youtube: '@shauk' });
    const cleared = await saveProfile(s.id, { displayName: 'Shauk & Co', publicPhone: '', publicEmail: '  ', instagram: '', youtube: '' });
    expect(cleared).toEqual({ userId: s.id, displayName: 'Shauk & Co', publicEmail: 's@x.co' });
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
  it('cannot be deactivated, lose the admin role or be deleted, even by another admin', async () => {
    process.env.ADMIN_EMAILS = 'boot@x.co';
    const boot = await createUser({ email: 'boot@x.co', roles: ['admin'] }, admin.email);
    await expect(updateUser(boot.id, { active: false }, admin.email)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('ADMIN_EMAILS') });
    await expect(updateUser(boot.id, { roles: ['seller'] }, admin.email)).rejects.toMatchObject({ status: 409 });
    await expect(updateUser(boot.id, { roles: [] }, admin.email)).rejects.toMatchObject({ status: 409 });
    expect((await updateUser(boot.id, { roles: ['admin', 'seller'] }, admin.email)).roles).toEqual(['admin', 'seller']);
    // Soft delete would leave a hidden row that sign-in reactivates, so a bootstrap admin cannot be deleted either.
    await expect(deleteUser(boot.id, admin.email)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('ADMIN_EMAILS') });
  });
});

describe('seller profiles: onboarding fields', () => {
  const ENV = ['S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'];
  afterEach(() => { for (const k of ENV) delete process.env[k]; });
  const withStorage = () => Object.assign(process.env, { S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's' });
  const own = (id: string, f = 'a.png') => `https://b.s3.ap-south-1.amazonaws.com/logos/${id}/${f}`;
  const seed = async () => { await (await getTestDb()).insert(categories).values({ name: 'Pottery' }).onConflictDoNothing(); };

  it('stores and returns website, category, logo, whatsapp (10 digits) and de-duplicated contact methods', async () => {
    await seed();
    const s = await makeSeller('s@x.co', 'S');
    const saved = await saveProfile(s.id, {
      displayName: 'S', publicPhone: '9989898999', instagram: 'shauk', website: 'https://shauk.co', category: 'pottery',
      logoUrl: 'https://cdn.example.com/l.png', whatsapp: '+91 99898 98999', contactMethods: ['whatsapp', 'phone', 'whatsapp', 'bogus', 'website'],
    });
    expect(saved).toMatchObject({ website: 'https://shauk.co', category: 'Pottery', logoUrl: 'https://cdn.example.com/l.png', whatsapp: '9989898999', contactMethods: ['whatsapp', 'website', 'phone'] });
    expect(await getProfileByEmail('s@x.co')).toMatchObject({ website: 'https://shauk.co', whatsapp: '9989898999' });
  });
  it('saves without the new fields, keeps stored ones when the keys are absent, and clears them when empty', async () => {
    await seed();
    const s = await makeSeller('s@x.co', 'S');
    expect(await saveProfile(s.id, { displayName: 'S' })).toEqual({ userId: s.id, displayName: 'S', publicEmail: 's@x.co' });
    await saveProfile(s.id, { displayName: 'S', website: 'https://shauk.co', category: 'Pottery', contactMethods: ['website'] });
    expect(await saveProfile(s.id, { displayName: 'S2' })).toMatchObject({ website: 'https://shauk.co', category: 'Pottery', contactMethods: ['website'] });
    const cleared = await saveProfile(s.id, { displayName: 'S', website: '', category: '', contactMethods: [] });
    expect(cleared).toEqual({ userId: s.id, displayName: 'S', publicEmail: 's@x.co' });
  });
  it('rejects an invalid website, whatsapp, category and contact methods with the onboarding messages, naming the field', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const cases: [object, string, string][] = [
      [{ website: 'ftp://x.co' }, 'website', 'Enter a website starting with http:// or https://.'],
      [{ website: 'x'.repeat(201) }, 'website', 'Website must be 200 characters or fewer.'],
      [{ whatsapp: '12345' }, 'whatsapp', 'Enter a valid WhatsApp number.'],
      [{ category: 'Nope' }, 'category', 'category must be an existing category. Create it first.'],
      [{ contactMethods: 'whatsapp' }, 'contactMethods', 'Choose at least one way for customers to reach you.'],
      [{ contactMethods: ['fax'] }, 'contactMethods', 'Choose at least one way for customers to reach you.'],
      [{ contactMethods: ['whatsapp'] }, 'whatsapp', 'Enter a valid WhatsApp number.'],
      [{ contactMethods: ['instagram'] }, 'instagram', 'Add your Instagram handle.'],
      [{ contactMethods: ['website'] }, 'website', 'Add your website.'],
      [{ contactMethods: ['phone'] }, 'publicPhone', 'Add a public phone to list Phone.'],
    ];
    for (const [extra, field, message] of cases)
      await expect(saveProfile(s.id, { displayName: 'S', ...extra })).rejects.toMatchObject({ status: 400, field, message });
    expect(await getProfileByEmail('s@x.co')).toEqual({ userId: s.id, displayName: 'S' });
  });
  it('contact methods are checked against the stored whatsapp/website when the keys are absent', async () => {
    const s = await makeSeller('s@x.co', 'S');
    await saveProfile(s.id, { displayName: 'S', whatsapp: '9989898999' });
    expect((await saveProfile(s.id, { displayName: 'S', contactMethods: ['whatsapp'] })).contactMethods).toEqual(['whatsapp']);
  });
  it('with storage configured the logo must be in the caller own logos/ folder; an unchanged stored logo saves again', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const other = await makeSeller('o@x.co', 'O');
    await saveProfile(s.id, { displayName: 'S', logoUrl: 'https://legacy.example.com/old.png' }); // saved before storage was configured
    withStorage();
    for (const url of [own(other.id), 'https://evil.example.com/a.png', own(s.id, '../x.png'), `https://b.s3.ap-south-1.amazonaws.com/logos/${s.id}/`])
      await expect(saveProfile(s.id, { displayName: 'S', logoUrl: url })).rejects.toMatchObject({ status: 400, field: 'logoUrl', message: 'Upload your logo.' });
    expect((await saveProfile(s.id, { displayName: 'S', logoUrl: 'https://legacy.example.com/old.png' })).logoUrl).toBe('https://legacy.example.com/old.png');
    expect((await saveProfile(s.id, { displayName: 'S', logoUrl: own(s.id) })).logoUrl).toBe(own(s.id));
    expect((await saveProfile(s.id, { displayName: 'S', logoUrl: own(s.id) })).logoUrl).toBe(own(s.id));
  });
  it('an unchanged stored category still saves after the category was deleted', async () => {
    await (await getTestDb()).insert(categories).values({ name: 'Temp Craft' });
    const s = await makeSeller('s@x.co', 'S');
    await saveProfile(s.id, { displayName: 'S', category: 'Temp Craft' });
    await (await getTestDb()).delete(categories).where(eq(categories.name, 'Temp Craft'));
    expect((await saveProfile(s.id, { displayName: 'S', category: 'Temp Craft' })).category).toBe('Temp Craft');
    await expect(saveProfile(s.id, { displayName: 'S', category: 'Textiles' })).rejects.toMatchObject({ field: 'category' });
  });
  it('without storage any http(s) logo link is accepted and other schemes are not', async () => {
    const s = await makeSeller('s@x.co', 'S');
    await expect(saveProfile(s.id, { displayName: 'S', logoUrl: 'javascript:alert(1)' })).rejects.toMatchObject({ status: 400, field: 'logoUrl' });
    expect((await saveProfile(s.id, { displayName: 'S', logoUrl: 'https://cdn.example.com/a.png' })).logoUrl).toBe('https://cdn.example.com/a.png');
    vi.stubEnv('NODE_ENV', 'production');
    try {
      await expect(saveProfile(s.id, { displayName: 'S', logoUrl: 'https://cdn.example.com/b.png' })).rejects.toMatchObject({ status: 400, field: 'logoUrl', message: 'Upload your logo.' });
      expect((await saveProfile(s.id, { displayName: 'S', logoUrl: 'https://cdn.example.com/a.png' })).logoUrl).toBe('https://cdn.example.com/a.png'); // the stored one may be saved again
    } finally { vi.unstubAllEnvs(); }
  });
});
