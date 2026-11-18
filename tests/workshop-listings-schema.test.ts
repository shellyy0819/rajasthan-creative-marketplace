import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { workshopPrices, workshopRequests, workshopTopics, workshops } from '@/db/schema';
import { resetTestDb } from './helpers/testdb';

const base = { id: 'w900', title: 'Morning flow', type: 'PAID', pricePaise: 50000, description: 'Yoga', hostName: 'Asha', startsAt: new Date('2027-01-05T01:30:00Z') };
const request = { hostName: 'Asha', contactName: 'Asha Rao', phone: '+919989898999', email: 'asha@example.com', title: 'Yoga', kind: 'class', description: 'd', startDate: '2027-01-05', endDate: '2027-01-05', priceType: 'PAID' };

let d: Awaited<ReturnType<typeof resetTestDb>>;
beforeEach(async () => { d = await resetTestDb(); });

describe('workshops table', () => {
  it('an in-person row written the old way still inserts, with the new defaults', async () => {
    const [city] = (await d.execute(sql`select id from cities limit 1`)).rows as { id: number }[];
    await d.insert(workshops).values({ ...base, cityId: city.id, venue: '12 MI Road', seats: 10 });
    const [w] = await d.select().from(workshops).where(eq(workshops.id, 'w900'));
    expect(w).toMatchObject({ mode: 'in_person', kind: 'workshop', languages: [], images: [], freeTrial: false, topicId: null, level: null });
  });
  it('an online row needs no city, venue or seats', async () => {
    await d.insert(workshops).values({ ...base, mode: 'online', kind: 'class', platform: 'Zoom' });
    const [w] = await d.select().from(workshops).where(eq(workshops.id, 'w900'));
    expect(w).toMatchObject({ mode: 'online', cityId: null, venue: null, seats: null });
  });
  it('an in-person row without a city is rejected', async () => {
    await expect(d.insert(workshops).values({ ...base, venue: 'x', seats: 3 })).rejects.toThrow();
  });
  it('rejects an unknown mode, kind or level', async () => {
    for (const v of [{ mode: 'tv' }, { kind: 'party' }, { level: 'expert' }]) {
      await expect(d.insert(workshops).values({ ...base, mode: 'online', ...v })).rejects.toThrow();
    }
  });
  it('every fixture workshop is in person', async () => {
    const rows = await d.select().from(workshops);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.mode === 'in_person' && r.kind === 'workshop')).toBe(true);
  });
});

describe('workshop_prices', () => {
  it('rejects a negative amount and goes away with its workshop', async () => {
    await d.insert(workshops).values({ ...base, mode: 'online', kind: 'class' });
    await expect(d.insert(workshopPrices).values({ workshopId: 'w900', label: 'Monthly', amountPaise: -1, position: 0 })).rejects.toThrow();
    await d.insert(workshopPrices).values({ workshopId: 'w900', label: 'Monthly', amountPaise: 150000, position: 0 });
    await d.delete(workshops).where(eq(workshops.id, 'w900'));
    expect(await d.select().from(workshopPrices).where(eq(workshopPrices.workshopId, 'w900'))).toEqual([]);
  });
});

describe('workshop_topics', () => {
  it('starts with Yoga and Crochet and refuses a name that differs only by case', async () => {
    const names = (await d.select().from(workshopTopics)).map(t => t.name).sort();
    expect(names).toEqual(['Crochet', 'Yoga']);
    await expect(d.insert(workshopTopics).values({ slug: 'yoga-2', name: 'YOGA', position: 9 })).rejects.toThrow();
  });
  it('a topic can have a parent', async () => {
    const [yoga] = await d.select().from(workshopTopics).where(eq(workshopTopics.slug, 'yoga'));
    const [p] = await d.insert(workshopTopics).values({ slug: 'prenatal-yoga', name: 'Prenatal Yoga', parentId: yoga.id, position: 3 }).returning();
    expect(p.parentId).toBe(yoga.id);
    await d.delete(workshopTopics).where(eq(workshopTopics.id, p.id)); // topics are reference data and survive resetTestDb
  });
});

describe('workshop_requests', () => {
  it('accepts an online class with no city or venue', async () => {
    const [r] = await d.insert(workshopRequests).values({ ...request, mode: 'online', platform: 'Zoom', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }] }).returning();
    expect(r).toMatchObject({ city: null, venue: null, mode: 'online', languages: [], freeTrial: false });
  });
  it('an existing in-person request still inserts and may become listed', async () => {
    const [r] = await d.insert(workshopRequests).values({ ...request, kind: 'workshop', city: 'Jaipur, Rajasthan', venue: 'x', status: 'listed' }).returning();
    expect(r.status).toBe('listed');
  });
});
