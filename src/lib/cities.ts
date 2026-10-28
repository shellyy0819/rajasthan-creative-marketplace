import { and, eq, exists, isNull, or, sql } from 'drizzle-orm';
import { getDb, type Q } from '../db/client';
import { cities, products, workshops, type CityRow } from '../db/schema';
import { slugify } from './slug';
import { ApiError } from './errors';
import { verifyCityRef } from './city-ref';

export type City = { id: number; name: string; state?: string; slug: string; lat?: number; lng?: number };

export const LAUNCH_CITIES: readonly { name: string; state: 'Rajasthan'; lat: number; lng: number }[] = [
  { name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125 },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lng: 73.0243 },
];

const toCity = (r: CityRow): City => ({
  id: r.id, name: r.name, slug: r.slug,
  ...(r.state ? { state: r.state } : {}),
  ...(r.lat != null ? { lat: r.lat } : {}),
  ...(r.lng != null ? { lng: r.lng } : {}),
});

/** Great-circle distance in kilometres. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const slugTaken = async (q: Q, slug: string) => (await q.select({ id: cities.id }).from(cities).where(eq(cities.slug, slug)).limit(1)).length > 0;

/** First city to claim a bare slug keeps it; a namesake gets `<name>-<state>`, then `<name>-<state>-<osmId>`. */
async function freeSlug(q: Q, name: string, state: string | undefined, osmId?: number): Promise<string> {
  const base = slugify(name) || 'city';
  const candidates = [base, ...(state ? [slugify(`${name} ${state}`)] : [])];
  for (const c of candidates) if (c && !(await slugTaken(q, c))) return c;
  const tail = `${candidates[candidates.length - 1]}-${osmId ?? Date.now()}`;
  let slug = tail;
  for (let i = 2; await slugTaken(q, slug); i++) slug = `${tail}-${i}`;
  return slug;
}

/** Idempotent on (osmType, osmId). */
export async function upsertCity(
  tx: Q,
  p: { osmType: string; osmId: number; name: string; state?: string; lat: number; lng: number },
): Promise<City> {
  const byOsm = () => tx.select().from(cities).where(and(eq(cities.osmType, p.osmType), eq(cities.osmId, p.osmId))).limit(1);
  const [existing] = await byOsm();
  if (existing) return toCity(existing);

  // Adopt a launch/legacy row with the same name that has no OSM identity yet. The `osm_id is null` guard on the
  // UPDATE keeps a concurrent adopter from being overwritten: if it loses the race, 0 rows update and we insert.
  const [legacy] = await tx.select().from(cities).where(and(
    isNull(cities.osmId), sql`lower(${cities.name}) = lower(${p.name})`,
    p.state ? or(isNull(cities.state), sql`lower(${cities.state}) = lower(${p.state})`) : sql`true`,
  )).orderBy(cities.id).limit(1);
  if (legacy) {
    const [r] = await tx.update(cities).set({
      osmType: p.osmType, osmId: p.osmId, state: legacy.state ?? p.state ?? null,
      lat: legacy.lat ?? p.lat, lng: legacy.lng ?? p.lng,
    }).where(and(eq(cities.id, legacy.id), isNull(cities.osmId))).returning();
    if (r) return toCity(r);
  }

  const insert = async () => {
    const slug = await freeSlug(tx, p.name, p.state, p.osmId);
    await tx.insert(cities).values({
      osmType: p.osmType, osmId: p.osmId, name: p.name.trim(), state: p.state ?? null, slug, lat: p.lat, lng: p.lng,
    }).onConflictDoNothing();
    return (await byOsm())[0];
  };
  // A concurrent writer may take the slug between freeSlug and the insert: retry once with a fresh slug.
  const row = (await insert()) ?? (await insert());
  if (!row) throw new ApiError(409, 'Could not save this city right now. Please try again.');
  return toCity(row);
}

/** Seed and legacy use only: find by name (case-insensitive) or create without OSM identity. */
export async function ensureCityByName(tx: Q, name: string, extra?: { state?: string; lat?: number; lng?: number }): Promise<City> {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('City name is required');
  const find = () => tx.select().from(cities).where(sql`lower(${cities.name}) = lower(${clean})`).orderBy(cities.id).limit(1);
  const [found] = await find();
  if (found) return toCity(found);
  const slug = await freeSlug(tx, clean, extra?.state);
  await tx.insert(cities).values({
    name: clean, slug, state: extra?.state ?? null, lat: extra?.lat ?? null, lng: extra?.lng ?? null,
  }).onConflictDoNothing();
  const [row] = (await find()).length ? await find() : await tx.select().from(cities).where(eq(cities.slug, slug)).limit(1);
  return toCity(row);
}

export async function getCityBySlug(slug: string): Promise<City | undefined> {
  const [r] = await getDb().select().from(cities).where(eq(cities.slug, slug)).limit(1);
  return r ? toCity(r) : undefined;
}

export async function getCityByNameOrSlug(v: string): Promise<City | undefined> {
  const t = v.trim();
  if (!t) return undefined;
  const [r] = await getDb().select().from(cities)
    .where(or(eq(cities.slug, t.toLowerCase()), sql`lower(${cities.name}) = lower(${t})`))
    .orderBy(sql`(${cities.slug} = ${t.toLowerCase()}) desc`, cities.id).limit(1);
  return r ? toCity(r) : undefined;
}

/** Cities with at least one APPROVED product or workshop, sorted by name. */
export async function listActiveCities(): Promise<City[]> {
  const db = getDb();
  const rows = await db.select().from(cities).where(or(
    exists(db.select({ x: sql`1` }).from(products).where(and(eq(products.cityId, cities.id), eq(products.status, 'APPROVED')))),
    exists(db.select({ x: sql`1` }).from(workshops).where(and(eq(workshops.cityId, cities.id), eq(workshops.status, 'APPROVED')))),
  )).orderBy(cities.name, cities.id);
  return rows.map(toCity);
}

export async function nearestActiveCities(
  from: { lat: number; lng: number },
  opts: { limit?: number; maxKm?: number } = {},
): Promise<(City & { km: number })[]> {
  const { limit = 5, maxKm = 300 } = opts;
  const active = await listActiveCities();
  const withKm = active.map(c => ({ ...c, km: c.lat != null && c.lng != null ? haversineKm(from, { lat: c.lat, lng: c.lng }) : -1 }));
  const near = withKm.filter(c => c.km >= 0 && c.km <= maxKm).sort((a, b) => a.km - b.km).slice(0, limit);
  return near.length ? near : withKm.sort((a, b) => (a.km < 0 ? 1 : 0) - (b.km < 0 ? 1 : 0) || a.km - b.km || a.name.localeCompare(b.name));
}

/**
 * The only way a write path turns user input into a city id. A signed `cityRef` (from place search) is verified and
 * upserted and wins over `cityId`; a numeric `cityId` must already exist. Neither => null, or 400 when required.
 */
export async function resolveCityInput(
  q: Q,
  raw: { cityId?: unknown; cityRef?: unknown },
  opts: { required: boolean } = { required: false },
): Promise<number | null> {
  const blank = (v: unknown) => v === undefined || v === null || v === '';
  if (!blank(raw.cityRef)) return (await upsertCity(q, verifyCityRef(raw.cityRef))).id;
  if (!blank(raw.cityId)) {
    const id = raw.cityId;
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) throw new ApiError(400, 'Unknown city.');
    const [r] = await q.select({ id: cities.id }).from(cities).where(eq(cities.id, id)).limit(1);
    if (!r) throw new ApiError(400, 'Unknown city.');
    return r.id;
  }
  if (opts.required) throw new ApiError(400, 'city is required.');
  return null;
}
