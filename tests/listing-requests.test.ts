import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { confirmListingRequest, createListingRequest, listListingRequests } from '@/lib/listing-requests';
import { resolveAccess } from '@/lib/roles';
import { listUsers } from '@/lib/users';
import { getProfileByEmail } from '@/lib/users';
import { listingRequests, users } from '@/db/schema';
import { getTestDb, giveRole } from './helpers/testdb';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const ok = { ownerName: 'Meera Sharma', phone: '+91 99898 98999', email: 'Meera@Pottery.IN', businessName: 'Meera Pottery', size: 'small' };

describe('createListingRequest', () => {
  it('stores a request with the phone normalised and optional fields omitted', async () => {
    const r = await createListingRequest(ok);
    expect(r).toMatchObject({ ownerName: 'Meera Sharma', phone: '+919989898999', email: 'meera@pottery.in', businessName: 'Meera Pottery', size: 'small', status: 'received' });
    expect(r).not.toHaveProperty('confirmedAt');
    expect(r).not.toHaveProperty('instagram'); expect(r).not.toHaveProperty('website');
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await listListingRequests()).toHaveLength(1);
  });
  it('trims text, keeps an instagram handle or url, and turns a bare domain into an https website', async () => {
    const r = await createListingRequest({ ...ok, ownerName: '  Meera  ', instagram: ' @meerapottery ', website: 'meerapottery.in' });
    expect(r).toMatchObject({ ownerName: 'Meera', instagram: '@meerapottery', website: 'https://meerapottery.in' });
    expect((await createListingRequest({ ...ok, website: 'http://a.in/x' })).website).toBe('http://a.in/x');
    expect(await createListingRequest({ ...ok, instagram: '', website: '' })).not.toHaveProperty('website');
  });
  it('requires owner name, a valid Indian mobile number, business name and a size', async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ ownerName: '' }, /ownerName/], [{ ownerName: '   ' }, /ownerName/], [{ ownerName: 5 }, /ownerName/],
      [{ email: '' }, /email/], [{ email: 'nope' }, /email/], [{ email: 'a@b' }, /email/], [{ email: undefined }, /email/], [{ email: 5 }, /email/], [{ email: 'a b@c.in' }, /email/],
      [{ phone: '' }, /phone/], [{ phone: '12345' }, /phone/], [{ phone: '5989898999' }, /phone/], [{ phone: undefined }, /phone/], [{ phone: 9989898999 }, /phone/],
      [{ businessName: '' }, /businessName/], [{ size: 'huge' }, /size/], [{ size: undefined }, /size/], [{ size: 'SMALL' }, /size/],
    ];
    for (const [bad, msg] of cases) await expect(createListingRequest({ ...ok, ...bad })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(msg) });
    expect(await listListingRequests()).toHaveLength(0);
  });
  it('accepts all three sizes', async () => {
    for (const size of ['small', 'medium', 'large']) expect((await createListingRequest({ ...ok, size })).size).toBe(size);
  });
  it('rejects over-long values, a non-http website and non-object bodies', async () => {
    for (const bad of [{ email: 'x'.repeat(250) + '@a.in' }, { ownerName: 'x'.repeat(101) }, { businessName: 'x'.repeat(151) }, { instagram: 'x'.repeat(201) }, { website: 'https://' + 'a'.repeat(300) + '.in' },
      { website: 'javascript:alert(1)' }, { website: 'ftp://x.in' }, { website: 'not a url' }])
      await expect(createListingRequest({ ...ok, ...bad })).rejects.toMatchObject({ status: 400 });
    for (const body of [null, [], 'x', 5]) await expect(createListingRequest(body)).rejects.toMatchObject({ status: 400 });
  });
  it('ignores unknown keys (no mass assignment of id, status or createdAt)', async () => {
    const r = await createListingRequest({ ...ok, id: 'evil', createdAt: '2000-01-01', admin: true, status: 'confirmed', confirmedBy: 'x' });
    expect(r.id).not.toBe('evil'); expect(r.createdAt.startsWith('2000')).toBe(false); expect(r.status).toBe('received');
  });
  it('lists newest first', async () => {
    const a = await createListingRequest({ ...ok, businessName: 'First' });
    await new Promise(r => setTimeout(r, 10)); // distinct timestamps: ordering is by creation time
    const b = await createListingRequest({ ...ok, businessName: 'Second' });
    expect((await listListingRequests()).map(r => r.id)).toEqual([b.id, a.id]);
  });
});

describe('confirmListingRequest', () => {
  const admin = 'root@x.co';
  beforeEach(async () => { await giveRole(admin, 'admin'); });

  it('creates the owner as a seller so they can sign in with that email, names the public profile after the business, and records who confirmed', async () => {
    const r = await createListingRequest(ok);
    expect((await resolveAccess('meera@pottery.in')).role).toBe('customer'); // before: nothing
    const c = await confirmListingRequest(r.id, admin);
    expect(c).toMatchObject({ id: r.id, status: 'confirmed' });
    expect(c.confirmedAt).toBeTruthy();
    expect(await resolveAccess('MEERA@pottery.in')).toEqual({ role: 'seller', active: true });
    const u = (await listUsers()).find(x => x.email === 'meera@pottery.in')!;
    expect(u).toMatchObject({ name: 'Meera Sharma', roles: ['seller'], active: true });
    expect(await getProfileByEmail('meera@pottery.in')).toMatchObject({ displayName: 'Meera Pottery' });
    const [row] = await (await getTestDb()).select().from(listingRequests).where(eq(listingRequests.id, r.id));
    const [adminRow] = await (await getTestDb()).select().from(users).where(eq(users.email, admin));
    expect(row.confirmedBy).toBe(adminRow.id);
  });
  it('does not copy the private phone or instagram into the public seller profile', async () => {
    const r = await createListingRequest({ ...ok, instagram: '@meera', website: 'meera.in' });
    await confirmListingRequest(r.id, admin);
    const p = await getProfileByEmail('meera@pottery.in');
    expect(p).not.toHaveProperty('publicPhone'); expect(p).not.toHaveProperty('instagram'); expect(p).not.toHaveProperty('publicEmail');
  });
  it('is idempotent: confirming again changes nothing and keeps the first confirmation', async () => {
    const r = await createListingRequest(ok);
    const a = await confirmListingRequest(r.id, admin);
    const b = await confirmListingRequest(r.id, admin);
    expect(b.confirmedAt).toBe(a.confirmedAt);
    expect((await listUsers()).filter(x => x.email === 'meera@pottery.in')).toHaveLength(1);
  });
  it('parallel confirms by two admins leave one user, one seller role and one confirmation', async () => {
    await giveRole('two@x.co', 'admin');
    const r = await createListingRequest(ok);
    const res = await Promise.all([confirmListingRequest(r.id, admin), confirmListingRequest(r.id, 'two@x.co'), confirmListingRequest(r.id, admin)]);
    expect(new Set(res.map(x => x.confirmedAt)).size).toBe(1);
    expect((await listUsers()).filter(x => x.email === 'meera@pottery.in')[0].roles).toEqual(['seller']);
  });
  it('an existing customer account gets the seller role and keeps its existing public profile name', async () => {
    await giveRole('meera@pottery.in', 'customer');
    const r = await createListingRequest(ok);
    await confirmListingRequest(r.id, admin);
    expect((await resolveAccess('meera@pottery.in')).role).toBe('seller');
  });
  it('an existing seller keeps their profile; a second request from the same email just confirms', async () => {
    const first = await createListingRequest(ok); await confirmListingRequest(first.id, admin);
    const second = await createListingRequest({ ...ok, businessName: 'Other Brand' });
    await confirmListingRequest(second.id, admin);
    expect(await getProfileByEmail('meera@pottery.in')).toMatchObject({ displayName: 'Meera Pottery' });
  });
  it('refuses to confirm for a deactivated account (409) and leaves the request as received', async () => {
    await giveRole('meera@pottery.in', 'seller');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.email, 'meera@pottery.in'));
    const r = await createListingRequest(ok);
    await expect(confirmListingRequest(r.id, admin)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/deactivated/) });
    expect((await listListingRequests())[0].status).toBe('received');
  });
  it('404 for an unknown or malformed id', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'nope', '', "x' or 1=1 --"]) await expect(confirmListingRequest(id, admin)).rejects.toMatchObject({ status: 404 });
  });
});
