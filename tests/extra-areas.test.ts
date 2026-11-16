import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyCityRef } from '@/lib/city-ref';
import { upsertCity } from '@/lib/cities';
import { DEFAULT_EXTRA_AREAS } from '@/lib/extra-areas-shared';
import { clearPlacesCache, extraAreaMatches, searchPlaces } from '@/lib/places';
import { getTestDb, resetTestDb } from './helpers/testdb';

const f = (props: Record<string, unknown>, coords = [78.47, 17.38]) => ({ properties: { countrycode: 'IN', ...props }, geometry: { coordinates: coords } });
const photon = (...features: ReturnType<typeof f>[]) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ features }) } as Response);
const hyderabad = f({ name: 'Hyderabad', state: 'Telangana', osm_value: 'city', osm_type: 'R', osm_id: 1 });
const names = (r: { name: string }[]) => r.map(p => p.name);

beforeEach(() => { clearPlacesCache(); vi.stubEnv('NEXTAUTH_SECRET', 'test-secret'); });
afterEach(() => vi.unstubAllEnvs());

describe('extra areas in the city search', () => {
  it('lists Hyderabad Shaikpet by the name people use', () => {
    expect(DEFAULT_EXTRA_AREAS.map(a => a.name)).toContain('Hyderabad Shaikpet');
  });
  it('finds it by its alias or any part of its name, but not for other places', () => {
    for (const q of ['shaik', 'Shaikpet', 'hyderabad shaikpet', 'hyd', 'hyderabad', 'pet']) expect(names([...extraAreaMatches(q).top, ...extraAreaMatches(q).after]), q).toContain('Hyderabad Shaikpet');
    for (const q of ['udaipur', 'jaipur', 'x', '']) expect(extraAreaMatches(q).top.length + extraAreaMatches(q).after.length, q).toBe(0);
  });
  it('puts it first when the typing is about the area, and after the city itself when it is only the city\'s name', async () => {
    const found = (q: string) => searchPlaces(q, (() => photon(hyderabad)) as never, { cityOnly: true });
    expect(names(await found('shaik'))).toEqual(['Hyderabad Shaikpet', 'Hyderabad']);
    expect(names(await found('hyderabad sh'))).toEqual(['Hyderabad Shaikpet', 'Hyderabad']);
    expect(names(await found('hyderabad'))).toEqual(['Hyderabad', 'Hyderabad Shaikpet']);
    expect(names(await found('hyd'))).toEqual(['Hyderabad', 'Hyderabad Shaikpet']);
  });
  it('labels it with its state and gives a signed reference the server accepts', async () => {
    const [p] = await searchPlaces('shaikpet', (() => photon()) as never, { cityOnly: true });
    expect(p).toMatchObject({ label: 'Hyderabad Shaikpet, Telangana', name: 'Hyderabad Shaikpet', state: 'Telangana' });
    expect(verifyCityRef(p.ref)).toMatchObject({ name: 'Hyderabad Shaikpet', state: 'Telangana', osmType: 'N', osmId: 2935018020 });
  });
  it('is only offered by the city search, not the pickup-location search', async () => {
    const fetchImpl = vi.fn(() => photon());
    expect(await searchPlaces('shaikpet', fetchImpl as never)).toEqual([]);
  });
  it('still answers when the place service is down, and says so only when there is nothing to offer', async () => {
    const down = (() => Promise.resolve({ ok: false, status: 503 } as Response)) as never;
    expect(names(await searchPlaces('shaikpet', down, { cityOnly: true }))).toEqual(['Hyderabad Shaikpet']);
    await expect(searchPlaces('udaipur', down, { cityOnly: true })).rejects.toMatchObject({ status: 502 });
  });
  it('does not show a duplicate when Photon returns the same label', async () => {
    const same = f({ name: 'Hyderabad Shaikpet', state: 'Telangana', osm_value: 'city', osm_type: 'R', osm_id: 2 });
    expect(names(await searchPlaces('shaikpet', (() => photon(same)) as never, { cityOnly: true }))).toEqual(['Hyderabad Shaikpet']);
  });
});

describe('a list passed in', () => {
  const mine = [{ name: 'Jaipur Bani Park', state: 'Rajasthan', aliases: ['Bani Park'], osmType: 'N', osmId: 77, lat: 26.93, lng: 75.79 }];
  it('replaces the default list: only those areas are offered', async () => {
    expect(names(await searchPlaces('bani', (() => photon()) as never, { cityOnly: true, areas: mine }))).toEqual(['Jaipur Bani Park']);
    expect(await searchPlaces('shaikpet', (() => photon()) as never, { cityOnly: true, areas: mine })).toEqual([]);
    expect(await searchPlaces('shaikpet', (() => photon()) as never, { cityOnly: true, areas: [] })).toEqual([]);
  });
});

describe('picking it', () => {
  beforeEach(async () => { await resetTestDb(); });
  it('creates a city called Hyderabad Shaikpet in Telangana, once however many times it is picked', async () => {
    const [p] = await searchPlaces('shaikpet', (() => photon()) as never, { cityOnly: true });
    const db = await getTestDb();
    const a = await upsertCity(db, verifyCityRef(p.ref)), b = await upsertCity(db, verifyCityRef(p.ref));
    expect(a).toMatchObject({ name: 'Hyderabad Shaikpet', state: 'Telangana', slug: 'hyderabad-shaikpet' });
    expect(b.id).toBe(a.id);
  });
});
