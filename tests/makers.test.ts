import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createProduct } from '@/lib/admin';
import { listHomeMakers, makerQuote, MAKER_QUOTE_MAX } from '@/lib/makers';
import { cities, sellerProfiles, users } from '@/db/schema';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });

describe('makerQuote', () => {
  it('is the first sentence of the bio, with spaces tidied', () => {
    expect(makerQuote('  I make   pots.  Then I fire them. ')).toBe('I make pots.');
    expect(makerQuote('Hand-crocheted frocks')).toBe('Hand-crocheted frocks');
  });
  it('is nothing for an empty bio', () => {
    for (const v of [undefined, null, '', '   ']) expect(makerQuote(v)).toBeUndefined();
  });
  it('cuts a long sentence at a word boundary and adds an ellipsis', () => {
    const q = makerQuote('word '.repeat(60))!;
    expect(q.endsWith('…')).toBe(true);
    expect(q.length).toBeLessThanOrEqual(MAKER_QUOTE_MAX + 1);
    expect(q).not.toMatch(/\swor…$/);
  });
});

describe('listHomeMakers', () => {
  const publish = (sellerId: string, status: 'APPROVED' | 'DRAFT') =>
    createProduct({ name: 'Bowl', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status, sellerId }, admin);

  it('lists makers with a published product, with craft, city, quote and the link slug', async () => {
    const db = await getTestDb();
    const s = await makeSeller('maker-a@x.co', 'Alpha Studio');
    await publish(s.id, 'APPROVED');
    const [city] = await db.select().from(cities).limit(1);
    await db.update(sellerProfiles).set({ category: 'Pottery', bio: 'Glazed by hand. Fired three times.', cityId: city.id }).where(eq(sellerProfiles.userId, s.id));
    const m = (await listHomeMakers()).find(x => x.name === 'Alpha Studio')!;
    expect(m).toMatchObject({ name: 'Alpha Studio', categories: ['Pottery'], city: city.name, quote: 'Glazed by hand.' });
    expect(m.slug).toMatch(/^alpha-studio-[0-9a-f]{8}$/);
    expect(m).not.toHaveProperty('logoUrl');
  });
  it('tags a maker with every category they sell in now, A to Z, and not categories only in drafts', async () => {
    const s = await makeSeller('maker-t@x.co', 'Tango Studio');
    const make = (category: string, status: 'APPROVED' | 'DRAFT') =>
      createProduct({ name: 'Thing', category, cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status, sellerId: s.id }, admin);
    await make('Pottery', 'APPROVED'); await make('Pottery', 'APPROVED'); await make('Accessories', 'APPROVED'); await make('Resin Art', 'DRAFT');
    expect((await listHomeMakers()).find(x => x.name === 'Tango Studio')!.categories).toEqual(['Accessories', 'Pottery']);
  });
  it('leaves out a maker with only unpublished products, and an inactive maker', async () => {
    const db = await getTestDb();
    const draft = await makeSeller('maker-b@x.co', 'Bravo Studio'); await publish(draft.id, 'DRAFT');
    const gone = await makeSeller('maker-c@x.co', 'Charlie Studio'); await publish(gone.id, 'APPROVED');
    await db.update(users).set({ active: false }).where(eq(users.id, gone.id));
    const names = (await listHomeMakers()).map(x => x.name);
    expect(names).not.toContain('Bravo Studio');
    expect(names).not.toContain('Charlie Studio');
  });
  it('keeps only the logo that is the maker\'s to show, and respects the limit', async () => {
    const db = await getTestDb();
    for (const [i, n] of ['Delta', 'Echo', 'Foxtrot'].entries()) { const s = await makeSeller(`maker-${i}@x.co`, `${n} Studio`); await publish(s.id, 'APPROVED'); }
    const [d] = await db.select().from(users).where(eq(users.email, 'maker-0@x.co'));
    await db.update(sellerProfiles).set({ logoUrl: 'javascript:alert(1)' }).where(eq(sellerProfiles.userId, d.id));
    const all = await listHomeMakers();
    expect(all.find(x => x.name === 'Delta Studio')).not.toHaveProperty('logoUrl');
    expect(await listHomeMakers(2)).toHaveLength(2);
  });
});
