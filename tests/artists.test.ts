import { describe, it, expect, beforeEach } from 'vitest';
import { getArtist } from '@/lib/artists';
import { artistIdPrefix, artistSlug } from '@/lib/artist-slug';
import { createProduct, updateProduct } from '@/lib/admin';
import { saveProfile } from '@/lib/users';
import { listProducts } from '@/lib/catalog';
import { admin } from './helpers/actors';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

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
    const p = await createProduct({ name: 'Bowl', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin);
    const a = (await getArtist(await slugOf(p.id)))!;
    expect(a).toMatchObject({ phone: '9989898999', email: 'hi@studio.co', instagram: 'studio', youtube: '@studio' });
    expect(JSON.stringify(a)).not.toContain('contact@x.co');                       // the login email is private
  });
  it('is undefined for unknown slugs, a wrong name part, junk, and artists with no published product (drafts are not enumerable)', async () => {
    const s = await makeSeller('draft@x.co', 'Only Drafts');
    const d = await createProduct({ name: 'Hidden', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'DRAFT', sellerId: s.id }, admin);
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
