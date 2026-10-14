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
