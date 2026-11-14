import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_ITEMS, MAX_STALLS, artFor, buildRealMakers, buildRealStalls, craftFor, getFairData, markMirror } from '@/lib/fair-data';
import { SAMPLE_MAKERS, sampleFairData } from '@/lib/fair-sample';
import { saveFairSettings } from '@/lib/fair-settings';
import { DEFAULT_STALLS, OPEN_LABEL, STALL_COUNT, fillStalls } from '@/lib/fair-stalls';
import { FEMALE_LOOKS, LOOKS, MALE_LOOKS, characterFor, formatCode, hash32, lookFor, normalizeCode, randomCode } from '@/lib/fair-characters';
import { CODE_ALPHABET, LOOK_IDS, isLookId } from '@/lib/fair-constants';
import type { Product } from '@/lib/types';
import { resetTestDb } from './helpers/testdb';

const prod = (seller: string, i: number, o: Partial<Product> = {}): Product => ({
  id: `p${seller}${i}`, name: `Thing ${i}`, category: 'Accessories', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 10000 + i, seller, description: '', stock: 1, status: 'APPROVED', sellerSlug: `${seller.toLowerCase()}-1`, ...o,
});
beforeEach(async () => { await resetTestDb(); });

describe('the default stalls', () => {
  it('are handmade crochet, resin art, wood craft, sarees and suits, and Christmas items, in that order', () => {
    expect(DEFAULT_STALLS.map(d => d.label)).toEqual(['Handmade crochet', 'Resin Art', 'Wood craft', 'Sarees and suits', 'Christmas items']);
  });
  it('the sample fair has a maker for each, then open stalls, eight places in all', () => {
    const d = sampleFairData();
    expect(d.stalls).toHaveLength(STALL_COUNT);
    expect(d.stalls.slice(0, 5).map(s => s.label)).toEqual(DEFAULT_STALLS.map(x => x.label));
    expect(d.stalls.slice(0, 5).every(s => s.maker)).toBe(true);
    expect(d.stalls.slice(5).every(s => !s.maker && s.label === OPEN_LABEL)).toBe(true);
    expect(d.makers).toEqual(SAMPLE_MAKERS);
    expect(d.makers.filter(m => m.mirror).map(m => m.category)).toEqual(['Sarees and suits']);
  });
  it('every sample item has artwork and a price', () => {
    for (const m of SAMPLE_MAKERS) for (const i of m.items) { expect(i.art).toBeTruthy(); expect(i.pricePaise).toBeGreaterThan(0); }
  });
});

describe('buildRealStalls', () => {
  const crochet = (s: string, n: number) => Array.from({ length: n }, (_, i) => prod(s, i, { category: 'Crochet & Textiles', name: `Crochet flower ${i}` }));
  it('puts the default categories first, each with the seller who has the most matching products', () => {
    const products = [...crochet('Big', 3), ...crochet('Small', 1), prod('Wood Co', 0, { category: 'Wood craft', name: 'Carved box' }), prod('Saree House', 0, { category: 'Sarees and suits', name: 'Silk saree' }), prod('Saree House', 1, { category: 'Sarees and suits', name: 'Cotton suit' })];
    const stalls = buildRealStalls(products);
    expect(stalls).toHaveLength(8);
    expect(stalls[0]).toMatchObject({ label: 'Handmade crochet', maker: { name: 'Big' } });
    expect(stalls[1]).toMatchObject({ label: 'Resin Art', maker: null });
    expect(stalls[2]).toMatchObject({ label: 'Wood craft', maker: { name: 'Wood Co' } });
    expect(stalls[3].maker!.name).toBe('Saree House');
    expect(stalls[4]).toMatchObject({ label: 'Christmas items', maker: null });
    expect(stalls[5].maker!.name).toBe('Small');
  });
  it('keeps an open stall named for its category when nobody sells it yet', () => {
    const stalls = buildRealStalls([]);
    expect(stalls.map(s => s.label)).toEqual([...DEFAULT_STALLS.map(d => d.label), OPEN_LABEL, OPEN_LABEL, OPEN_LABEL]);
    expect(stalls.every(s => !s.maker)).toBe(true);
  });
  it('a seller fills one stall only, and each stall shows at most 4 items', () => {
    const stalls = buildRealStalls(Array.from({ length: 9 }, (_, i) => prod('Everything', i, { category: i % 2 ? 'Resin Art' : 'Crochet & Textiles', name: 'Crochet resin thing' })));
    expect(stalls.filter(s => s.maker).length).toBe(1);
    expect(stalls[0].maker!.items).toHaveLength(MAX_ITEMS);
  });
  it('links products and artists, and chooses artwork from the name and category', () => {
    const m = buildRealMakers([prod('Solo', 0, { name: 'Kundan Earrings', category: 'Accessories' })])[0];
    expect(m.items[0]).toMatchObject({ art: 'drop', href: expect.stringMatching(/^\/products\//) });
    expect(m.href).toBe('/artists/solo-1');
  });
  it('treats seller names case- and space-insensitively and caps the extra stalls at 8 places', () => {
    expect(buildRealMakers([prod('Rang  Ghar', 0), prod('rang ghar', 1)])).toHaveLength(1);
    expect(buildRealStalls(Array.from({ length: 14 }, (_, i) => prod(`Seller${i}`, 0)))).toHaveLength(MAX_STALLS);
  });
  it('gives exactly one stall the mirror, preferring a maker with something to wear', () => {
    const wear = buildRealStalls([prod('A', 0), prod('B', 0, { category: 'Sarees and suits', name: 'Silk saree' })]);
    expect(wear.flatMap(s => (s.maker?.mirror ? [s.maker.name] : []))).toEqual(['B']);
    const none = buildRealStalls([prod('A', 0), prod('B', 0)]);
    expect(none.filter(s => s.maker?.mirror)).toHaveLength(1);
    expect(markMirror(fillStalls([]))).toHaveLength(8);
  });
  it('is stable: the same sellers always look the same', () => {
    expect(buildRealMakers([prod('A', 0)])[0].look).toEqual(buildRealMakers([prod('A', 0)])[0].look);
  });
});

describe('artFor / craftFor', () => {
  it('picks artwork and craft from the category and name', () => {
    expect(artFor({ name: 'Aqua Jhumka', category: 'Accessories' })).toBe('drop');
    expect(artFor({ name: 'Pink Lotus', category: 'Crochet & Textiles' })).toBe('lily');
    expect(artFor({ name: 'Cardigan', category: 'Crochet & Textiles' })).toBe('frock');
    expect(artFor({ name: 'Coaster', category: 'Resin Art' })).toBe('coaster');
    expect(artFor({ name: 'Toy elephant', category: 'Wood craft' })).toBe('woodtoy');
    expect(artFor({ name: 'Jewellery box', category: 'Wood craft' })).toBe('woodbox');
    expect(artFor({ name: 'Bandhani saree', category: 'Sarees and suits' })).toBe('saree');
    expect(artFor({ name: 'Cotton suit set', category: 'Sarees and suits' })).toBe('suit');
    expect(artFor({ name: 'Silk dupatta', category: 'Sarees and suits' })).toBe('stole');
    expect(artFor({ name: 'Felt tree', category: 'Christmas items' })).toBe('tree');
    expect(artFor({ name: 'Star ornament', category: 'Christmas items' })).toBe('ornament');
    expect(artFor({ name: 'Mystery', category: 'Other' })).toBe('box');
    expect(craftFor('Wood craft')).toBe('wood');
    expect(craftFor('Christmas items')).toBe('christmas');
    expect(craftFor('Sarees and suits')).toBe('print');
    expect(craftFor('Crochet & Textiles')).toBe('crochet');
    expect(craftFor('Anything else')).toBe('handmade');
  });
});

describe('getFairData', () => {
  it('shows the invented sample makers by default', async () => {
    const d = await getFairData();
    expect(d.source).toBe('sample');
    expect(d.makers).toEqual(SAMPLE_MAKERS);
  });
  it('shows live sellers once an admin switches to real, with the default stalls first', async () => {
    await saveFairSettings({ source: 'real' }, 'root@x.co');
    const d = await getFairData();
    expect(d.source).toBe('real');
    expect(d.stalls).toHaveLength(8);
    expect(d.stalls.slice(0, 5).map(s => s.label)).toEqual(DEFAULT_STALLS.map(x => x.label));
    expect(d.makers.every(m => m.items.every(i => i.href?.startsWith('/products/')))).toBe(true);
    expect(JSON.stringify(d)).not.toContain('Rangili Dhaga');
  });
});

describe('looks, characters and codes', () => {
  it('has five female and five male looks', () => {
    expect(LOOK_IDS).toHaveLength(10);
    expect(FEMALE_LOOKS).toHaveLength(5); expect(MALE_LOOKS).toHaveLength(5);
    expect(FEMALE_LOOKS.every(id => LOOKS[id].gender === 'female' && id.startsWith('f'))).toBe(true);
    expect(MALE_LOOKS.every(id => LOOKS[id].gender === 'male' && id.startsWith('m'))).toBe(true);
    expect(new Set(LOOK_IDS.map(id => LOOKS[id].name)).size).toBe(10);
    expect(isLookId('f3')).toBe(true); expect(isLookId('x1')).toBe(false); expect(isLookId(3)).toBe(false);
  });
  it('every look is drawable: colours are hex, hair is a known style', () => {
    for (const id of LOOK_IDS) { const c = LOOKS[id]; expect(c.id).toBe(id); for (const col of [c.top, c.skin, c.acc, c.pants]) expect(col).toMatch(/^#[0-9a-f]{6}$/i); expect(['short', 'long', 'bun', 'braid', 'bob']).toContain(c.hairStyle); }
  });
  it('a code starts with the same look everywhere, a picked look wins', () => {
    expect(lookFor('ABC234')).toBe(lookFor('ABC234'));
    expect(characterFor('ABC234')).toEqual(characterFor('ABC234'));
    expect(characterFor('ABC234').id).toBe(lookFor('ABC234'));
    expect(characterFor('ABC234', 'm4').name).toBe('Rudra');
    const starts = new Set(Array.from({ length: 60 }, (_, i) => lookFor(`${CODE_ALPHABET[i % 31]}BC${CODE_ALPHABET[(i * 7) % 31]}34`)));
    expect(starts.size).toBeGreaterThan(5);
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
