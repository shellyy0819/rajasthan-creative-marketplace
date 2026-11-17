import { beforeEach, describe, expect, it } from 'vitest';
import { asc, eq, sql } from 'drizzle-orm';
import { categories } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

/** Slugs of the categories these tests add (the default ones are ignored). */
const add = async (...names: string[]) => {
  const d = await getTestDb();
  const out: string[] = [];
  for (const name of names) {
    const [r] = await d.insert(categories).values({ name }).returning({ slug: categories.slug });
    out.push(r.slug);
  }
  return out;
};

beforeEach(async () => { await resetTestDb(); });

describe('category slugs (made by the database)', () => {
  it('a new category gets a lowercase, hyphenated slug', async () => {
    expect(await add('Oil Paintings')).toEqual(['oil-paintings']);
  });
  it('& becomes "and", accents are folded, punctuation collapses', async () => {
    expect(await add('Arts & Crafts', 'Café Décor', 'Pots, Pans / Jars')).toEqual(['arts-and-crafts', 'cafe-decor', 'pots-pans-jars']);
  });
  it('names that slugify the same get -2, -3 in insert order', async () => {
    expect(await add('Home Decor X', 'Home-Decor X', 'Home, Decor X')).toEqual(['home-decor-x', 'home-decor-x-2', 'home-decor-x-3']);
  });
  it('a name with no Latin letters gets category, category-2 (never empty or duplicate)', async () => {
    const d = await getTestDb();
    await d.execute(sql`delete from categories where slug like 'category%'`);
    expect(await add('हस्तशिल्प', 'मिट्टी के बर्तन')).toEqual(['category', 'category-2']);
  });
  it('renaming keeps the slug', async () => {
    const d = await getTestDb();
    const [slug] = await add('Crochet Old');
    await d.update(categories).set({ name: 'Crochet New' }).where(eq(categories.slug, slug));
    const [row] = await d.select({ name: categories.name, slug: categories.slug }).from(categories).where(eq(categories.slug, slug));
    expect(row).toEqual({ name: 'Crochet New', slug: 'crochet-old' });
  });
  it('the slug is unique: a direct duplicate is refused', async () => {
    const d = await getTestDb();
    const [a] = await add('Slug One');
    await add('Slug Two');
    await expect(d.update(categories).set({ slug: a }).where(eq(categories.name, 'Slug Two'))).rejects.toThrow();
  });
  it('the default categories all have a slug after the migration', async () => {
    const d = await getTestDb();
    const rows = await d.select({ name: categories.name, slug: categories.slug }).from(categories).orderBy(asc(categories.id));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(rows.map(r => r.slug)).size).toBe(rows.length);
  });
  it('the backfill fills empty slugs in id order, deterministically, and is idempotent', async () => {
    const d = await getTestDb();
    await d.execute(sql`alter table categories disable trigger categories_set_slug`);
    try {
      await d.insert(categories).values([{ name: 'Backfill Pots' }, { name: 'Backfill-Pots' }, { name: 'Backfill Jars' }]);
      const empty = await d.select({ slug: categories.slug }).from(categories).where(sql`${categories.name} like 'Backfill%'`);
      expect(empty.map(r => r.slug)).toEqual(['', '', '']);
      await d.execute(sql`select category_backfill_slugs()`);
      const read = async () => (await d.select({ name: categories.name, slug: categories.slug }).from(categories).where(sql`${categories.name} like 'Backfill%'`).orderBy(asc(categories.id)));
      expect(await read()).toEqual([{ name: 'Backfill Pots', slug: 'backfill-pots' }, { name: 'Backfill-Pots', slug: 'backfill-pots-2' }, { name: 'Backfill Jars', slug: 'backfill-jars' }]);
      await d.execute(sql`select category_backfill_slugs()`);
      expect((await read()).map(r => r.slug)).toEqual(['backfill-pots', 'backfill-pots-2', 'backfill-jars']);
    } finally {
      await d.execute(sql`alter table categories enable trigger categories_set_slug`);
    }
  });
});
