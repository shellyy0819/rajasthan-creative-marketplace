import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb, resetTestDb } from './helpers/testdb';
import { workshopTopics, workshops, products } from '@/db/schema';
import { createTopic, setTopicActive } from '@/lib/topics';
import { countProducts } from '@/lib/catalog';
import { matchItems } from '@/lib/trend-match';
import type { TrendItem } from '@/lib/trend-types';

const item = (over: Partial<TrendItem> = {}): TrendItem => ({
  id: 'i1', kind: 'workshop', title: 'Something', why: 'Buyers keep asking for this lately.', tags: [], origin: 'web',
  sources: [{ title: 'Design weekly' }], show: true, ...over,
});

let crochetId: number;
let yogaId: number;
const topicId = async (slug: string) => (await (await getTestDb()).select().from(workshopTopics).where(eq(workshopTopics.slug, slug)))[0].id;

beforeAll(async () => { await getTestDb(); }, 30_000);
beforeEach(async () => {
  await resetTestDb();
  crochetId = await topicId('crochet');
  yogaId = await topicId('yoga');
}, 30_000);

describe('workshop items', () => {
  it('counts approved workshops that have not ended for the topic named in the title', async () => {
    const d = await getTestDb();
    await d.update(workshops).set({ topicId: crochetId }).where(eq(workshops.id, 'w1'));
    await d.update(workshops).set({ topicId: crochetId }).where(eq(workshops.id, 'w2'));
    await d.update(workshops).set({ topicId: yogaId }).where(eq(workshops.id, 'w3'));
    const [m] = await matchItems([item({ title: 'Crochet circles are growing' })]);
    expect(m.count).toBe(2);
    expect(m.href).toBe('/workshops?q=Crochet');
    expect(m).toMatchObject({ id: 'i1', title: 'Crochet circles are growing', kind: 'workshop' });
  });
  it('does not count an ended or a draft workshop', async () => {
    const d = await getTestDb();
    await d.update(workshops).set({ topicId: crochetId }).where(eq(workshops.id, 'w1'));
    await d.update(workshops).set({ topicId: crochetId, startsAt: new Date('2020-01-05T05:30:00Z') }).where(eq(workshops.id, 'w2')); // ended
    await d.update(workshops).set({ topicId: crochetId, status: 'DRAFT' }).where(eq(workshops.id, 'w3'));
    const [m] = await matchItems([item({ title: 'Crochet' })]);
    expect(m.count).toBe(1);
  });
  it('counts a multi-day workshop until its last day', async () => {
    const d = await getTestDb();
    await d.update(workshops).set({ topicId: crochetId, startsAt: new Date('2020-01-05T05:30:00Z'), endsOn: '2099-12-31' }).where(eq(workshops.id, 'w1'));
    expect((await matchItems([item({ title: 'Crochet' })]))[0].count).toBe(1);
  });
  it('finds the topic in the tags, case-insensitively', async () => {
    const d = await getTestDb();
    await d.update(workshops).set({ topicId: yogaId }).where(eq(workshops.id, 'w1'));
    const [m] = await matchItems([item({ title: 'Slow mornings', tags: ['calm', 'YOGA'] })]);
    expect(m.count).toBe(1);
    expect(m.href).toBe('/workshops?q=Yoga');
  });
  it('picks the longest topic name that appears', async () => {
    const d = await getTestDb();
    const long = await createTopic({ name: 'Yoga Therapy' });
    await d.update(workshops).set({ topicId: long.id }).where(eq(workshops.id, 'w1'));
    await d.update(workshops).set({ topicId: yogaId }).where(eq(workshops.id, 'w2'));
    const [m] = await matchItems([item({ title: 'Why yoga therapy is rising' })]);
    expect(m.href).toBe('/workshops?q=Yoga%20Therapy');
    expect(m.count).toBe(1);
    await d.update(workshops).set({ topicId: null }).where(eq(workshops.topicId, long.id));
    await d.delete(workshopTopics).where(eq(workshopTopics.id, long.id));
  });
  it('ignores an inactive topic', async () => {
    const d = await getTestDb();
    await d.update(workshops).set({ topicId: crochetId }).where(eq(workshops.id, 'w1'));
    await setTopicActive(crochetId, false);
    try {
      const [m] = await matchItems([item({ title: 'Crochet' })]);
      expect(m).toMatchObject({ count: 0, href: '/workshops' });
    } finally { await setTopicActive(crochetId, true); }
  });
  it('gives count 0 and /workshops when no topic matches', async () => {
    const [m] = await matchItems([item({ title: 'Underwater basket weaving', tags: ['wet'] })]);
    expect(m).toMatchObject({ count: 0, href: '/workshops' });
  });
  it('gives count 0 and the topic link when the topic has no current workshop', async () => {
    const [m] = await matchItems([item({ title: 'Yoga' })]);
    expect(m).toMatchObject({ count: 0, href: '/workshops?q=Yoga' });
  });
});

describe('craft and art items', () => {
  it('counts products for a tag that equals a product category and links to the shop search', async () => {
    const d = await getTestDb();
    const [p] = await d.select().from(products).where(eq(products.status, 'APPROVED')).limit(1);
    const category = p.category;
    expect(await countProducts({ q: category })).toBeGreaterThan(0);
    const [m] = await matchItems([item({ kind: 'craft', category: 'Nothing like this xyz', tags: ['no match qq', category] })]);
    expect(m.count).toBeGreaterThan(0);
    expect(m.href).toBe(`/shop?q=${encodeURIComponent(category)}`);
  });
  it('keeps the term with the largest count', async () => {
    const [m] = await matchItems([item({ kind: 'art', category: 'Pottery', tags: ['Resin Art', 'Pottery'] })]);
    const counts = await Promise.all(['Pottery', 'Resin Art'].map(q => countProducts({ q })));
    expect(m.count).toBe(Math.max(...counts));
  });
  it('encodes the term in the link', async () => {
    const d = await getTestDb();
    const [p] = await d.select().from(products).where(eq(products.category, 'Crochet & Textiles')).limit(1);
    expect(p).toBeTruthy();
    const [m] = await matchItems([item({ kind: 'craft', category: 'Crochet & Textiles', tags: [] })]);
    expect(m.href).toBe('/shop?q=Crochet%20%26%20Textiles');
    expect(m.count).toBeGreaterThan(0);
  });
  it('gives count 0 and /shop when nothing matches', async () => {
    const [m] = await matchItems([item({ kind: 'craft', category: 'Qqzzxx', tags: ['Wwvvyy'] })]);
    expect(m).toMatchObject({ count: 0, href: '/shop' });
  });
  it('gives count 0 and /shop when there is no category or tag', async () => {
    const [m] = await matchItems([item({ kind: 'art', tags: [] })]);
    expect(m).toMatchObject({ count: 0, href: '/shop' });
  });
  it('keeps the order of the items and handles a mix', async () => {
    const out = await matchItems([item({ id: 'a', kind: 'art', tags: [] }), item({ id: 'b', title: 'Yoga' }), item({ id: 'c', kind: 'craft', tags: [] })]);
    expect(out.map(m => m.id)).toEqual(['a', 'b', 'c']);
    expect(await matchItems([])).toEqual([]);
  });
});
