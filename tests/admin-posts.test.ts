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
