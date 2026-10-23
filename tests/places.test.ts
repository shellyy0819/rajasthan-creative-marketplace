import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyCityRef } from '@/lib/city-ref';
import { searchPlaces, placeLabel, clearPlacesCache, PLACES_URL } from '@/lib/places';

const f = (props: Record<string, unknown>) => ({ properties: { countrycode: 'IN', ...props } });
const photon = (...features: ReturnType<typeof f>[]) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ features }) } as Response);

beforeEach(() => { clearPlacesCache(); vi.stubEnv('NEXTAUTH_SECRET', 'test-secret'); });
afterEach(() => vi.unstubAllEnvs());

describe('placeLabel', () => {
  it('builds "name, area, state" and drops repeated parts', () => {
    expect(placeLabel({ name: 'Udaipur', county: 'Udaipur', state: 'Rajasthan' })).toBe('Udaipur, Rajasthan');
    expect(placeLabel({ name: 'Ambrai Restaurant', city: 'Udaipur', county: 'Girwa Tehsil', state: 'Rajasthan' })).toBe('Ambrai Restaurant, Udaipur, Rajasthan');
    expect(placeLabel({ name: 'City Station', street: 'City Station Road', city: 'Udaipur', state: 'Rajasthan' })).toBe('City Station, City Station Road, Udaipur, Rajasthan');
    expect(placeLabel({ name: 'Bani Park', district: 'Bani Park', city: 'Jaipur', state: 'Rajasthan' })).toBe('Bani Park, Jaipur, Rajasthan');
  });
  it('falls back gracefully when parts are missing', () => {
    expect(placeLabel({ name: 'Somewhere' })).toBe('Somewhere');
    expect(placeLabel({ state: 'Rajasthan' })).toBe('Rajasthan');
    expect(placeLabel({})).toBe('');
  });
});

describe('searchPlaces', () => {
  it('asks Photon for India-bounded English results and sends a User-Agent', async () => {
    const fetchImpl = vi.fn(() => photon());
    await searchPlaces('udai', fetchImpl as never);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(PLACES_URL);
    expect(u.searchParams.get('q')).toBe('udai');
    expect(u.searchParams.get('lang')).toBe('en');
    expect(u.searchParams.get('bbox')).toBe('68.1,6.7,97.4,35.7');
    expect(u.searchParams.get('limit')).toBe('20');
    expect(u.searchParams.has('lat')).toBe(false); // a location bias buries big cities under nearby villages
    expect((init.headers as Record<string, string>)['user-agent']).toMatch(/Craftology/);
  });
  it('keeps only India, puts Rajasthan first, removes duplicates and returns at most 6 labelled suggestions', async () => {
    const fetchImpl = vi.fn(() => photon(
      f({ name: 'Udai', state: 'Maharashtra', county: 'Akrani Taluka' }),
      f({ name: 'Udai', countrycode: 'NP', state: 'Province' }),
      f({ name: 'Udaipur', county: 'Udaipur', state: 'Rajasthan' }),
      f({ name: 'Udaipur', state: 'Rajasthan' }),
      f({ name: 'Udaipur City', city: 'Udaipur', state: 'Rajasthan' }),
      f({ name: 'Udaipura', state: 'Madhya Pradesh' }),
      f({ name: 'A', state: 'Rajasthan' }), f({ name: 'B', state: 'Rajasthan' }), f({ name: 'C', state: 'Rajasthan' }), f({ name: 'D', state: 'Rajasthan' }),
    ));
    const out = await searchPlaces('udai', fetchImpl as never);
    expect(out.map(p => p.label)).toEqual(['Udaipur, Rajasthan', 'Udaipur City, Udaipur, Rajasthan', 'A, Rajasthan', 'B, Rajasthan', 'C, Rajasthan', 'D, Rajasthan']);
    expect(out.every(p => p.label && p.name)).toBe(true);
  });
  it('within Rajasthan, cities and towns rank before villages, areas and landmarks; Photon order breaks ties', async () => {
    const fetchImpl = vi.fn(() => photon(
      f({ name: 'Udaipura', osm_value: 'village', state: 'Rajasthan', county: 'Chaksu Tehsil' }),
      f({ name: 'Udai Kalan', osm_value: 'hamlet', state: 'Rajasthan' }),
      f({ name: 'Udaipur Fort Cafe', osm_value: 'cafe', city: 'Udaipur', state: 'Rajasthan' }),
      f({ name: 'Udaipurwati', osm_value: 'town', state: 'Rajasthan' }),
      f({ name: 'Udaipur', osm_value: 'city', county: 'Udaipur', state: 'Rajasthan' }),
      f({ name: 'Udaipur Colony', osm_value: 'suburb', city: 'Jaipur', state: 'Rajasthan' }),
    ));
    const out = (await searchPlaces('udai', fetchImpl as never)).map(p => p.label);
    expect(out.slice(0, 2)).toEqual(['Udaipur, Rajasthan', 'Udaipurwati, Rajasthan']);
    expect(out.indexOf('Udaipur Colony, Jaipur, Rajasthan')).toBeLessThan(out.indexOf('Udaipura, Chaksu Tehsil, Rajasthan'));
    expect(out.indexOf('Udaipura, Chaksu Tehsil, Rajasthan')).toBeLessThan(out.indexOf('Udai Kalan, Rajasthan'));
  });
  it('names that start with what was typed rank before fuzzy neighbours ("ambra" -> Ambrai before Amba)', async () => {
    const fetchImpl = vi.fn(() => photon(
      f({ name: 'Amba', osm_value: 'village', state: 'Rajasthan' }),
      f({ name: 'Amora', osm_value: 'village', state: 'Rajasthan' }),
      f({ name: 'Ambrai Ghat', osm_value: 'yes', city: 'Udaipur', state: 'Rajasthan' }),
      f({ name: 'Old Ambrai Hotel', osm_value: 'hotel', city: 'Udaipur', state: 'Rajasthan' }),
    ));
    const out = (await searchPlaces('ambra', fetchImpl as never)).map(p => p.label);
    expect(out[0]).toBe('Ambrai Ghat, Udaipur, Rajasthan');
    expect(out.indexOf('Ambrai Ghat, Udaipur, Rajasthan')).toBeLessThan(out.indexOf('Amba, Rajasthan'));
  });
  it('returns [] without calling the network for blank or one-character queries; trims and caps long ones', async () => {
    const fetchImpl = vi.fn(() => photon());
    expect(await searchPlaces('   ', fetchImpl as never)).toEqual([]);
    expect(await searchPlaces('a', fetchImpl as never)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await searchPlaces('  udai   pur  ' + 'x'.repeat(500), fetchImpl as never);
    expect(new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]).searchParams.get('q')!.length).toBeLessThanOrEqual(100);
    expect(new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]).searchParams.get('q')).toMatch(/^udai pur x/);
  });
  it('caches identical queries (case-insensitive) so typing the same thing does not hit Photon again', async () => {
    const fetchImpl = vi.fn(() => photon(f({ name: 'Udaipur', state: 'Rajasthan' })));
    await searchPlaces('Udaipur', fetchImpl as never);
    await searchPlaces('  udaipur ', fetchImpl as never);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('a failing or malformed upstream becomes a 502 ApiError; it is not cached', async () => {
    const bad = vi.fn(() => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) } as Response));
    await expect(searchPlaces('udaipur', bad as never)).rejects.toMatchObject({ status: 502, message: 'Place search is unavailable.' });
    const junk = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ nope: 1 }) } as Response));
    await expect(searchPlaces('udaipur', junk as never)).rejects.toMatchObject({ status: 502 });
    const boom = vi.fn(() => Promise.reject(new Error('network')));
    await expect(searchPlaces('udaipur', boom as never)).rejects.toMatchObject({ status: 502 });
    const ok = vi.fn(() => photon(f({ name: 'Udaipur', state: 'Rajasthan' })));
    expect((await searchPlaces('udaipur', ok as never)).length).toBe(1);
  });
  it('gives up after the timeout instead of hanging', async () => {
    vi.useFakeTimers();
    const hang = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted')))));
    const p = searchPlaces('udaipur', hang as never);
    const assertion = expect(p).rejects.toMatchObject({ status: 502 });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    vi.useRealTimers();
  });
  it('ignores features with no usable name and unexpected shapes', async () => {
    const fetchImpl = vi.fn(() => photon(f({}), { properties: null } as never, f({ name: '   ' }), f({ name: 'Real', state: 'Rajasthan' })));
    expect((await searchPlaces('real', fetchImpl as never)).map(p => p.label)).toEqual(['Real, Rajasthan']);
  });
});

describe('searchPlaces cityOnly', () => {
  const g = (props: Record<string, unknown>, coords: unknown = [73.68, 24.58]) => ({ ...f(props), ...(coords ? { geometry: { type: 'Point', coordinates: coords } } : {}) });
  it('drops localities and results without coordinates, keeps villages, and attaches a verifiable ref', async () => {
    const fetchImpl = vi.fn(() => photon(
      g({ name: 'Udaipur', osm_value: 'city', osm_type: 'R', osm_id: 1, state: 'Rajasthan' }),
      g({ name: 'Udaipurwati', osm_value: 'town', osm_type: 'N', osm_id: 2, state: 'Rajasthan' }),
      g({ name: 'Udaipura', osm_value: 'village', osm_type: 'N', osm_id: 3, state: 'Rajasthan' }),
      g({ name: 'Udaipur Colony', osm_value: 'suburb', osm_type: 'N', osm_id: 4, state: 'Rajasthan' }),
      g({ name: 'Udai Fort', osm_value: 'cafe', osm_type: 'N', osm_id: 5, state: 'Rajasthan' }),
      g({ name: 'Udai Nocoords', osm_value: 'city', osm_type: 'N', osm_id: 6, state: 'Rajasthan' }, null),
    ));
    const out = await searchPlaces('udai', fetchImpl as never, { cityOnly: true });
    expect(out.map(p => p.name)).toEqual(['Udaipur', 'Udaipurwati', 'Udaipura']);
    expect(verifyCityRef(out[0].ref)).toEqual({ osmType: 'R', osmId: 1, name: 'Udaipur', state: 'Rajasthan', lat: 24.58, lng: 73.68 });
  });
  it('caches cityOnly and plain searches separately', async () => {
    const fetchImpl = vi.fn(() => photon(g({ name: 'Udaipur', osm_value: 'city', osm_type: 'R', osm_id: 1, state: 'Rajasthan' })));
    const plain = await searchPlaces('udai', fetchImpl as never);
    const city = await searchPlaces('udai', fetchImpl as never, { cityOnly: true });
    expect(plain[0]).not.toHaveProperty('ref');
    expect(city[0].ref).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('plain and cityOnly caches never serve each other, even for a query that looks like a prefix', async () => {
    const mk = () => vi.fn(() => photon(g({ name: 'Udaipur', osm_value: 'city', osm_type: 'R', osm_id: 1, state: 'Rajasthan' })));
    const a = mk();
    await searchPlaces('city:udai', a as never);
    const cityHit = await searchPlaces('udai', a as never, { cityOnly: true });
    expect(a).toHaveBeenCalledTimes(2);
    expect(cityHit[0].ref).toBeTruthy();
    clearPlacesCache();
    const b = mk();
    await searchPlaces('udai', b as never, { cityOnly: true });
    const plain = await searchPlaces('city:udai', b as never);
    expect(b).toHaveBeenCalledTimes(2);
    expect(plain[0]).not.toHaveProperty('ref');
  });
  it('without cityOnly is unchanged (no ref)', async () => {
    const fetchImpl = vi.fn(() => photon(g({ name: 'Udaipur', osm_value: 'city', osm_type: 'R', osm_id: 1, state: 'Rajasthan' })));
    expect(await searchPlaces('udai', fetchImpl as never)).toEqual([{ label: 'Udaipur, Rajasthan', name: 'Udaipur', state: 'Rajasthan' }]);
  });
});
