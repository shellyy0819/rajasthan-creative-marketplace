import { describe, it, expect, beforeEach } from 'vitest';
import { listProductsForAdmin, getProductForAdmin, listArtists, listSellerOptions, scopeFor } from '@/lib/admin-posts';
import { artistKey } from '@/lib/artist';
import { createProduct, createWorkshop, deleteProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';
import { saveProfile } from '@/lib/users';
import { admin } from './helpers/actors';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

beforeEach(async () => {
  await resetTestDb();
});
const base = { name: 'Lac Bangle', category: 'Accessories', cityRef: cityRef('Jodhpur'), pricePaise: 12000, description: 'Hand-set.', stock: 3 };

describe('artistKey', () => {
  it('treats case and spacing variants as one artist', () => {
    expect(artistKey('Shauk and Stuff')).toBe(artistKey('  SHAUK   and  stuff '));
  });
});

describe('listProductsForAdmin', () => {
  it('includes drafts that the public listing hides, newest first, with seller details', async () => {
    const s = await makeSeller('marwar@x.co', 'Marwar Lac');
    await createProduct({ ...base, status: 'DRAFT' }, s.actor);
    const all = await listProductsForAdmin();
    expect(all.map(p => p.id)).toEqual(['p5', 'p4', 'p3', 'p2', 'p1']);
    expect(all[0]).toMatchObject({ seller: 'Marwar Lac', sellerId: s.id, sellerEmail: 'marwar@x.co', status: 'DRAFT' });
    expect((await listProducts()).map(p => p.id)).not.toContain('p5');
  });
  it('filters by artist (case/space-insensitive), status and text', async () => {
    const s = await makeSeller('marwar@x.co', 'Marwar Lac');
    await createProduct({ ...base, status: 'DRAFT' }, s.actor);
    expect((await listProductsForAdmin({ artist: '  shauk AND stuff' })).map(p => p.id)).toEqual(['p1']);
    expect((await listProductsForAdmin({ status: 'DRAFT' })).map(p => p.id)).toEqual(['p5']);
    expect((await listProductsForAdmin({ q: 'BLUE' })).map(p => p.id)).toEqual(['p4']);
    expect((await listProductsForAdmin({ q: 'marwar' })).map(p => p.id)).toEqual(['p5']); // searches the seller name too
  });
});

describe('getProductForAdmin', () => {
  it('returns a draft; 404 for a missing id', async () => {
    const s = await makeSeller('marwar@x.co', 'Marwar Lac');
    const d = await createProduct({ ...base, status: 'DRAFT' }, s.actor);
    expect((await getProductForAdmin(d.id)).status).toBe('DRAFT');
    await expect(getProductForAdmin('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('listArtists', () => {
  it('groups by the seller public name case-insensitively with published/draft counts, sorted by name', async () => {
    const a = await makeSeller('a@x.co', 'shauk and stuff'); // same public name as the seeded seller, different user
    await createProduct({ ...base, status: 'DRAFT' }, a.actor);
    const artists = await listArtists();
    const shauk = artists.find(x => x.key === 'shauk and stuff')!;
    expect(shauk).toMatchObject({ total: 2, published: 1, drafts: 1 });
    expect(artists.map(x => x.name)).toEqual([...artists.map(x => x.name)].sort((x, y) => x.localeCompare(y)));
  });
  it('an artist disappears when their last post is deleted; renaming the seller profile moves their posts', async () => {
    await deleteProduct('p2');
    expect((await listArtists()).find(a => a.name === 'Lake City Knots')).toMatchObject({ total: 0, noPosts: true }); // still a maker, now flagged
    const { users } = await import('@/db/schema');
    const { getTestDb } = await import('./helpers/testdb');
    const { eq } = await import('drizzle-orm');
    const [u] = await (await getTestDb()).select().from(users).where(eq(users.email, 'shauk-and-stuff@seed.rangrajasthan.invalid'));
    await saveProfile(u.id, { displayName: 'New Studio' });
    const names = (await listArtists()).map(a => a.name);
    expect(names).toContain('New Studio');
    expect(names).not.toContain('Shauk and Stuff');
    expect((await getProductForAdmin('p1')).seller).toBe('New Studio');
  });
  it('a seller scope only counts their own posts', async () => {
    const s = await makeSeller('marwar@x.co', 'Marwar Lac');
    await createProduct(base, s.actor);
    await createProduct(base, admin);
    const mine = await listArtists(scopeFor({ email: 'marwar@x.co', role: 'seller' }));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: 'Marwar Lac', total: 1 });
  });
});

describe('listArtists flags makers with nothing posted', () => {
  const online = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, status: 'APPROVED' };
  it('lists a seller with no products and no workshops, flagged, with zero counts', async () => {
    await makeSeller('new@x.co', 'Fresh Maker');
    const a = (await listArtists()).find(x => x.name === 'Fresh Maker');
    expect(a).toMatchObject({ total: 0, published: 0, drafts: 0, noPosts: true });
  });
  it('does not flag a maker who has a product, even only a draft', async () => {
    const s = await makeSeller('d@x.co', 'Draft Maker');
    await createProduct({ ...base, status: 'DRAFT' }, s.actor);
    const a = (await listArtists()).find(x => x.name === 'Draft Maker')!;
    expect(a.total).toBe(1);
    expect(a.noPosts).toBeFalsy();
  });
  it('leaves out a maker with a workshop but no product (they have posted)', async () => {
    const s = await makeSeller('w@x.co', 'Workshop Only');
    await createWorkshop({ ...online, hostId: s.id });
    expect((await listArtists()).some(x => x.name === 'Workshop Only')).toBe(false);
  });
  it('treats a workshop that only carries the seller email as their contact as a post', async () => {
    await makeSeller('c@x.co', 'Contact Maker');
    await createWorkshop({ ...online, contactEmail: 'C@x.co' });
    expect((await listArtists()).some(x => x.name === 'Contact Maker')).toBe(false);
  });
  it('ignores inactive sellers and admins, and never adds them to a seller scope', async () => {
    const { users } = await import('@/db/schema');
    const { getTestDb } = await import('./helpers/testdb');
    const { eq } = await import('drizzle-orm');
    const s = await makeSeller('off@x.co', 'Gone Maker');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, s.id));
    await makeSeller('on@x.co', 'Fresh Maker');
    expect((await listArtists()).some(x => x.name === 'Gone Maker')).toBe(false);
    expect(await listArtists(scopeFor({ email: 'on@x.co', role: 'seller' }))).toEqual([]);
  });
});

describe('listSellerOptions (admin seller picker)', () => {
  it('returns id, display name, email and public phone so same-named sellers can be told apart', async () => {
    const a = await makeSeller('twin1@x.co', 'Twin Studio');
    const b = await makeSeller('twin2@x.co', 'Twin Studio');
    await saveProfile(a.id, { displayName: 'Twin Studio', publicPhone: '99898 98999' });
    const opts = await listSellerOptions();
    const twins = opts.filter(o => o.name === 'Twin Studio');
    expect(twins).toHaveLength(2);
    expect(twins.find(o => o.id === a.id)).toEqual({ id: a.id, name: 'Twin Studio', email: 'twin1@x.co', phone: '9989898999' });
    expect(twins.find(o => o.id === b.id)).toEqual({ id: b.id, name: 'Twin Studio', email: 'twin2@x.co' });
  });
  it('lists only active users with the seller or admin role', async () => {
    const { giveRole } = await import('./helpers/testdb');
    await giveRole('buyer@x.co', 'customer');
    const off = await makeSeller('off@x.co', 'Off');
    const { users } = await import('@/db/schema');
    const { getTestDb } = await import('./helpers/testdb');
    const { eq } = await import('drizzle-orm');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, off.id));
    const emails = (await listSellerOptions()).map(o => o.email);
    expect(emails).not.toContain('buyer@x.co');
    expect(emails).not.toContain('off@x.co');
    expect(emails).toContain('shauk-and-stuff@seed.rangrajasthan.invalid');
  });
});
