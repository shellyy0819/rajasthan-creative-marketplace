import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_ITEMS, MAX_STALLS, artFor, buildRealMakers, craftFor, getFairData } from '@/lib/fair-data';
import { SAMPLE_MAKERS } from '@/lib/fair-sample';
import { saveFairSettings } from '@/lib/fair-settings';
import { CODE_ALPHABET } from '@/lib/fair-presence';
import { characterFor, formatCode, hash32, normalizeCode, randomCode } from '@/lib/fair-characters';
import type { Product } from '@/lib/types';
import { resetTestDb } from './helpers/testdb';

const prod = (seller: string, i: number, o: Partial<Product> = {}): Product => ({
  id: `p${seller}${i}`, name: `Thing ${i}`, category: 'Accessories', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 10000 + i, seller, description: '', stock: 1, status: 'APPROVED', sellerSlug: `${seller.toLowerCase()}-1`, ...o,
});
beforeEach(async () => { await resetTestDb(); });

describe('buildRealMakers', () => {
  it('makes one stall per seller, busiest first, with at most 4 items each', () => {
    const products = [...Array.from({ length: 6 }, (_, i) => prod('Big', i)), prod('Small', 0), prod('Mid', 0), prod('Mid', 1)];
    const makers = buildRealMakers(products);
    expect(makers.map(m => m.name)).toEqual(['Big', 'Mid', 'Small']);
    expect(makers[0].items).toHaveLength(MAX_ITEMS);
    expect(makers[0].items[0]).toMatchObject({ key: 'big:0', name: 'Thing 0', href: expect.stringMatching(/^\/products\//) });
    expect(makers[0].href).toBe('/artists/big-1');
  });
  it('keeps at most 8 stalls and treats seller names case- and space-insensitively', () => {
    const products = Array.from({ length: 12 }, (_, i) => prod(`Seller${i}`, 0));
    expect(buildRealMakers(products)).toHaveLength(MAX_STALLS);
    expect(buildRealMakers([prod('Rang  Ghar', 0), prod('rang ghar', 1)])).toHaveLength(1);
  });
  it('gives exactly one stall the mirror, preferring a maker with earrings', () => {
    const none = buildRealMakers([prod('A', 0), prod('B', 0)]);
    expect(none.filter(m => m.mirror)).toHaveLength(1);
    const withEarrings = buildRealMakers([prod('A', 0), prod('A', 1), prod('B', 0, { name: 'Kundan Earrings' })]);
    expect(withEarrings.find(m => m.mirror)!.name).toBe('B');
  });
  it('is stable: the same sellers always look the same', () => {
    expect(buildRealMakers([prod('A', 0)])[0].look).toEqual(buildRealMakers([prod('A', 0)])[0].look);
  });
  it('returns nothing for no products', () => { expect(buildRealMakers([])).toEqual([]); });
});

describe('artFor / craftFor', () => {
  it('picks artwork and craft from the category and name', () => {
    expect(artFor({ name: 'Aqua Jhumka', category: 'Accessories' })).toBe('drop');
    expect(artFor({ name: 'Pink Lotus', category: 'Crochet & Textiles' })).toBe('lily');
    expect(artFor({ name: 'Cardigan', category: 'Crochet & Textiles' })).toBe('frock');
    expect(artFor({ name: 'Bowl', category: 'Pottery' })).toBe('pot');
    expect(artFor({ name: 'Coaster', category: 'Resin Art' })).toBe('coaster');
    expect(artFor({ name: 'Mystery', category: 'Other' })).toBe('box');
    expect(craftFor('Pottery')).toBe('pottery');
    expect(craftFor('Crochet & Textiles')).toBe('crochet');
    expect(craftFor('Anything else')).toBe('handmade');
  });
});

describe('getFairData', () => {
  it('shows the invented sample makers by default', async () => {
    const d = await getFairData();
    expect(d.source).toBe('sample');
    expect(d.makers).toBe(SAMPLE_MAKERS);
    expect(d.makers.filter(m => m.mirror)).toHaveLength(1);
  });
  it('shows live approved sellers once an admin switches to real', async () => {
    await saveFairSettings({ source: 'real' }, 'root@x.co');
    const d = await getFairData();
    expect(d.source).toBe('real');
    expect(d.makers.length).toBeGreaterThan(0);
    expect(d.makers.length).toBeLessThanOrEqual(MAX_STALLS);
    expect(d.makers.every(m => m.items.every(i => i.href?.startsWith('/products/')))).toBe(true);
    expect(JSON.stringify(d)).not.toContain('Rangili Dhaga');
  });
});

describe('visitor characters and codes', () => {
  it('the same code always gives the same character, other codes can differ', () => {
    expect(characterFor('ABC234')).toEqual(characterFor('ABC234'));
    const names = new Set(Array.from({ length: 40 }, (_, i) => characterFor(`${CODE_ALPHABET[i % 31]}BC${CODE_ALPHABET[(i * 7) % 31]}34`).top + characterFor(`${CODE_ALPHABET[i % 31]}BC${CODE_ALPHABET[(i * 7) % 31]}34`).name));
    expect(names.size).toBeGreaterThan(8);
  });
  it('makes valid random codes', () => {
    for (let i = 0; i < 20; i++) expect(randomCode(CODE_ALPHABET)).toMatch(new RegExp(`^[${CODE_ALPHABET}]{6}$`));
    expect(randomCode('AB', () => new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe('ABABAB');
  });
  it('formats and normalizes codes', () => {
    expect(formatCode('ABC234')).toBe('ABC-234');
    expect(normalizeCode(' abc-234 ')).toBe('ABC234');
    expect(hash32('x')).toBe(hash32('x'));
  });
});
