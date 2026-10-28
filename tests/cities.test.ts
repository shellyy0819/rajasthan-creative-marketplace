import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/client';
import { cities, products, workshops } from '../src/db/schema';
import { ensureCityByName, getCityByNameOrSlug, getCityBySlug, haversineKm, listActiveCities, nearestActiveCities, upsertCity } from '../src/lib/cities';
import { resetTestDb } from './helpers/testdb';

const UDAIPUR = { lat: 24.5854, lng: 73.7125 };
const JAIPUR = { lat: 26.9124, lng: 75.7873 };

beforeEach(async () => { await resetTestDb({ products: [], workshops: [], orders: [], bookings: [], counters: {} } as never); });

const mk = (n: string, id: number, lat?: number, lng?: number, state = 'Rajasthan') =>
  upsertCity(getDb(), { osmType: 'N', osmId: id, name: n, state, lat: lat as number, lng: lng as number });

async function addProduct(cityId: number, status: 'APPROVED' | 'ARCHIVED', id: string) {
  const db = getDb();
  const { ensureUser } = await import('../src/db/people');
  const u = await ensureUser(db, `s-${id}@x.invalid`, 'S');
  await db.insert(products).values({ id, sellerId: u.id, name: id, category: 'Pottery', cityId, pricePaise: 100, description: 'd', stock: 1, status });
}

describe('cities library', () => {
  it('upsertCity returns the same row for the same osm id', async () => {
    const a = await mk('Kota', 1, 25.2, 75.8);
    const b = await mk('Kota', 1, 25.2, 75.8);
    expect(b.id).toBe(a.id);
    expect(a.slug).toBe('kota');
  });

  it("a second Udaipur in Tripura gets slug 'udaipur-tripura' and Rajasthan keeps 'udaipur'", async () => {
    const raj = await mk('Udaipur', 10, UDAIPUR.lat, UDAIPUR.lng);
    const tri = await mk('Udaipur', 11, 23.5, 91.5, 'Tripura');
    expect(raj.slug).toBe('udaipur');
    expect(tri.slug).toBe('udaipur-tripura');
    expect((await getCityBySlug('udaipur-tripura'))?.id).toBe(tri.id);
  });

  it('ensureCityByName finds case-insensitively and getCityByNameOrSlug resolves both', async () => {
    const a = await ensureCityByName(getDb(), 'Pune');
    expect((await ensureCityByName(getDb(), ' pune ')).id).toBe(a.id);
    expect((await getCityByNameOrSlug('PUNE'))?.id).toBe(a.id);
    expect((await getCityByNameOrSlug('pune'))?.id).toBe(a.id);
    expect(await getCityByNameOrSlug('nowhere')).toBeUndefined();
  });

  it('listActiveCities omits a city whose only product is ARCHIVED', async () => {
    const a = await mk('Alwar', 20, 27.5, 76.6);
    const b = await mk('Bundi', 21, 25.4, 75.6);
    await addProduct(a.id, 'APPROVED', 'p1');
    await addProduct(b.id, 'ARCHIVED', 'p2');
    expect((await listActiveCities()).map(c => c.name)).toEqual(['Alwar']);
  });

  it('listActiveCities counts an APPROVED workshop', async () => {
    const c = await mk('Pushkar', 22, 26.5, 74.5);
    await getDb().insert(workshops).values({ id: 'w1', title: 't', type: 'PAID', pricePaise: 1, cityId: c.id, venue: 'v', startsAt: new Date(), seats: 1, booked: 0, hostName: 'h', description: 'd', status: 'APPROVED' } as never);
    expect((await listActiveCities()).map(x => x.name)).toEqual(['Pushkar']);
    await getDb().update(workshops).set({ status: 'ARCHIVED' }).where(eq(workshops.id, 'w1'));
    expect(await listActiveCities()).toEqual([]);
  });

  it('nearestActiveCities orders by distance, caps at 5, skips cities without coordinates', async () => {
    const list = [
      await mk('A1', 30, 24.6, 73.7), await mk('A2', 31, 24.9, 73.9), await mk('A3', 32, 25.1, 74.0),
      await mk('A4', 33, 25.3, 74.2), await mk('A5', 34, 25.5, 74.4), await mk('A6', 35, 25.7, 74.6),
      await ensureCityByName(getDb(), 'NoCoords'),
    ];
    for (const [i, c] of list.entries()) await addProduct(c.id, 'APPROVED', `n${i}`);
    const r = await nearestActiveCities(UDAIPUR);
    expect(r.map(c => c.name)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
    expect(r[0].km).toBeLessThan(r[4].km);
  });

  it('nearestActiveCities returns all active cities when none is within 300 km', async () => {
    const far = await mk('Chennai', 40, 13.08, 80.27, 'Tamil Nadu');
    const nc = await ensureCityByName(getDb(), 'NoCoords');
    await addProduct(far.id, 'APPROVED', 'f1');
    await addProduct(nc.id, 'APPROVED', 'f2');
    const r = await nearestActiveCities(UDAIPUR);
    expect(r.map(c => c.name).sort()).toEqual(['Chennai', 'NoCoords']);
    expect(r.find(c => c.name === 'Chennai')!.km).toBeGreaterThan(1000);
    expect(r.find(c => c.name === 'NoCoords')!.km).toBe(-1);
  });

  it('haversineKm(Udaipur, Jaipur) is about 330', () => {
    expect(haversineKm(UDAIPUR, JAIPUR)).toBeGreaterThan(300);
    expect(haversineKm(UDAIPUR, JAIPUR)).toBeLessThan(360);
  });
});

describe('launch cities survive an empty seed and are adopted by OSM picks', () => {
  const launch = async () => (await getDb().select().from(cities).orderBy(cities.id)).filter(c => c.osmId === null);
  const udaipur = async () => (await getCityBySlug('udaipur'))!;

  it('seeding with an empty legacy db leaves Udaipur, Jaipur and Jodhpur with their bare slugs', async () => {
    const rows = await getDb().select().from(cities);
    expect(rows.map(r => r.slug).sort()).toEqual(['jaipur', 'jodhpur', 'udaipur']);
    for (const r of rows) expect(r).toMatchObject({ state: 'Rajasthan', osmId: null });
  });

  it('Tripura first leaves the launch row alone; Rajasthan then adopts it and keeps slug udaipur; repeats are idempotent', async () => {
    const before = await udaipur();
    const tri = await upsertCity(getDb(), { osmType: 'relation', osmId: 7001, name: 'Udaipur', state: 'Tripura', lat: 23.5, lng: 91.5 });
    expect(tri.slug).toBe('udaipur-tripura');
    expect(tri.id).not.toBe(before.id);
    expect((await launch()).map(r => r.slug)).toContain('udaipur'); // still un-adopted

    const raj = await upsertCity(getDb(), { osmType: 'relation', osmId: 7002, name: 'Udaipur', state: 'Rajasthan', lat: 24.58, lng: 73.71 });
    expect(raj.id).toBe(before.id);
    expect(raj.slug).toBe('udaipur');
    const again = await upsertCity(getDb(), { osmType: 'relation', osmId: 7002, name: 'Udaipur', state: 'Rajasthan', lat: 24.58, lng: 73.71 });
    expect(again.id).toBe(before.id);
  });

  it('a launch row that already has an OSM id is not adopted by a different OSM id of the same name and state', async () => {
    const first = await upsertCity(getDb(), { osmType: 'relation', osmId: 7101, name: 'Udaipur', state: 'Rajasthan', lat: 24.58, lng: 73.71 });
    expect(first.slug).toBe('udaipur');
    const other = await upsertCity(getDb(), { osmType: 'relation', osmId: 7102, name: 'Udaipur', state: 'Rajasthan', lat: 24.6, lng: 73.7 });
    expect(other.id).not.toBe(first.id);
    expect(other.slug).toBe('udaipur-rajasthan');
    expect((await udaipur()).id).toBe(first.id);
  });
});
