import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate, revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

import { GET as AREAS_GET, POST as AREAS_POST, DELETE as AREAS_DELETE } from '@/app/api/admin/settings/areas/route';
import { GET as AREAS_SEARCH } from '@/app/api/admin/settings/areas/search/route';
import { GET as PLACES, resetPlacesRateLimit } from '@/app/api/places/route';
import { addExtraArea, getExtraAreas, removeExtraArea } from '@/lib/extra-areas';
import { DEFAULT_EXTRA_AREAS, MAX_EXTRA_AREAS } from '@/lib/extra-areas-shared';
import { signCityRef } from '@/lib/city-ref';
import { clearPlacesCache, searchAreas } from '@/lib/places';
import { resetTestDb } from './helpers/testdb';

const photonFetch = (...features: unknown[]) => vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ features }) } as Response));
const feature = (props: Record<string, unknown>, coords = [78.4006536, 17.4057955]) => ({ properties: { countrycode: 'IN', state: 'Telangana', ...props }, geometry: { coordinates: coords } });
const suburb = feature({ name: 'Shaikpet', osm_value: 'suburb', osm_type: 'N', osm_id: 2935018020 });
const pickOf = async (...features: unknown[]) => (await searchAreas('shaikpet', photonFetch(...features) as never))[0];
const req = (method: string, body?: unknown, url = 'http://x/api') => new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });

beforeEach(async () => { await resetTestDb(); clearPlacesCache(); resetPlacesRateLimit(); revalidate.mockReset(); authMock.mockReset(); authMock.mockResolvedValue(null); vi.stubEnv('NEXTAUTH_SECRET', 'test-secret'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('the area search for admins', () => {
  it('finds suburbs and neighbourhoods only, each with a signed reference', async () => {
    const found = await searchAreas('shaikpet', photonFetch(suburb, feature({ name: 'Hyderabad', osm_value: 'city', osm_type: 'R', osm_id: 1 }), feature({ name: 'Shaikpet Flyover', osm_value: 'primary', osm_type: 'W', osm_id: 3 })) as never);
    expect(found.map(p => p.name)).toEqual(['Shaikpet']);
    expect(found[0].ref).toBeTruthy();
  });
});

describe('the saved list', () => {
  it('is the default (Hyderabad Shaikpet) until an admin saves one', async () => { expect((await getExtraAreas()).map(a => a.name)).toEqual(DEFAULT_EXTRA_AREAS.map(a => a.name)); });
  it('adds an area under the name chosen, keeps the OpenStreetMap name searchable, and sorts by name', async () => {
    const p = await pickOf(suburb);
    const list = await addExtraArea({ ref: p.ref, name: 'Hyderabad Shaikpet' }, 'a@x.co');
    expect(list.find(a => a.osmId === 2935018020)).toMatchObject({ name: 'Hyderabad Shaikpet', state: 'Telangana', aliases: ['Shaikpet'], osmType: 'N' });
    expect(await getExtraAreas()).toEqual(list);
  });
  it('needs no alias when the name is the area\'s own', async () => {
    const [p] = await searchAreas('shaikpet', photonFetch(suburb) as never);
    const list = await addExtraArea({ ref: p.ref }, 'a@x.co');
    expect(list.find(a => a.osmId === 2935018020)).toMatchObject({ name: 'Shaikpet', aliases: [] });
  });
  it('adding the same area again renames it instead of repeating it', async () => {
    const p = await pickOf(suburb);
    await addExtraArea({ ref: p.ref, name: 'Shaikpet' }, 'a@x.co');
    const list = await addExtraArea({ ref: p.ref, name: 'Hyderabad Shaikpet' }, 'a@x.co');
    expect(list.filter(a => a.osmId === 2935018020)).toHaveLength(1);
    expect(list.find(a => a.osmId === 2935018020)!.name).toBe('Hyderabad Shaikpet');
  });
  it('removes an area, and an empty saved list stays empty (it does not bring the default back)', async () => {
    const p = await pickOf(suburb);
    await addExtraArea({ ref: p.ref, name: 'Hyderabad Shaikpet' }, 'a@x.co');
    expect(await removeExtraArea({ osmType: 'N', osmId: 2935018020 }, 'a@x.co')).toEqual([]);
    expect(await getExtraAreas()).toEqual([]);
    await expect(removeExtraArea({ osmType: 'N', osmId: 2935018020 }, 'a@x.co')).rejects.toMatchObject({ status: 404 });
    await expect(removeExtraArea({}, 'a@x.co')).rejects.toMatchObject({ status: 400 });
  });
  it('rejects a missing, forged or expired reference and a name that is too short or too long', async () => {
    const p = await pickOf(suburb);
    await expect(addExtraArea({ name: 'X Y' }, 'a@x.co')).rejects.toMatchObject({ status: 400 });
    await expect(addExtraArea({ ref: p.ref + 'x', name: 'Hyderabad Shaikpet' }, 'a@x.co')).rejects.toMatchObject({ status: 400 });
    const old = signCityRef({ osmType: 'N', osmId: 9, name: 'Old', lat: 1, lng: 1 }, Date.now() - 3 * 86_400_000);
    await expect(addExtraArea({ ref: old, name: 'Old area' }, 'a@x.co')).rejects.toMatchObject({ status: 400 });
    await expect(addExtraArea({ ref: p.ref, name: 'H' }, 'a@x.co')).rejects.toMatchObject({ status: 400 });
    await expect(addExtraArea({ ref: p.ref, name: 'x'.repeat(81) }, 'a@x.co')).rejects.toMatchObject({ status: 400 });
    expect(await getExtraAreas()).toEqual([...DEFAULT_EXTRA_AREAS]);
  });
  it('holds at most 100 areas', async () => {
    await removeExtraArea({ osmType: 'N', osmId: 2935018020 }, 'a@x.co');   // start from an empty saved list
    for (let i = 0; i < MAX_EXTRA_AREAS; i++) await addExtraArea({ ref: signCityRef({ osmType: 'N', osmId: 1000 + i, name: `Area ${i}`, lat: 10, lng: 70 }), name: `Area ${String(i).padStart(3, '0')}` }, 'a@x.co');
    expect((await getExtraAreas()).length).toBe(MAX_EXTRA_AREAS + 1 - 1 + (DEFAULT_EXTRA_AREAS.length - DEFAULT_EXTRA_AREAS.length));
    await expect(addExtraArea({ ref: signCityRef({ osmType: 'N', osmId: 5000, name: 'One more', lat: 10, lng: 70 }), name: 'One more' }, 'a@x.co')).rejects.toMatchObject({ status: 400 });
  });
});

describe('admin API', () => {
  it('is for admins only', async () => {
    expect((await AREAS_GET()).status).toBe(401);
    for (const role of ['customer', 'seller']) {
      as(role);
      expect((await AREAS_GET()).status).toBe(403);
      expect((await AREAS_POST(req('POST', { ref: 'x', name: 'Yy' }))).status).toBe(403);
      expect((await AREAS_DELETE(req('DELETE', { osmType: 'N', osmId: 1 }))).status).toBe(403);
      expect((await AREAS_SEARCH(req('GET', undefined, 'http://x/api?q=shaik'))).status).toBe(403);
    }
  });
  it('adds, lists and removes, refreshing the site\'s pages each time', async () => {
    as('admin');
    const p = await pickOf(suburb);
    const add = await AREAS_POST(req('POST', { ref: p.ref, name: 'Hyderabad Shaikpet' }));
    expect(add.status).toBe(200); expect(revalidate).toHaveBeenCalledTimes(1);
    expect((await (await AREAS_GET()).json() as { areas: { name: string }[] }).areas.map(a => a.name)).toContain('Hyderabad Shaikpet');
    expect((await AREAS_DELETE(req('DELETE', { osmType: 'N', osmId: 2935018020 }))).status).toBe(200); expect(revalidate).toHaveBeenCalledTimes(2);
    expect((await AREAS_DELETE(req('DELETE', { osmType: 'N', osmId: 2935018020 }))).status).toBe(404); expect(revalidate).toHaveBeenCalledTimes(2);
    expect((await AREAS_POST(req('POST', { ref: 'nope', name: 'Yy' }))).status).toBe(400);
  });
});

describe('the City field search', () => {
  const search = async (q: string) => { const r = await PLACES(new Request(`http://x/api/places?q=${encodeURIComponent(q)}&type=city`)); return { r, found: (await r.json()) as { name: string }[] }; };
  it('offers the areas an admin saved at once, is not kept by the browser, and stops offering a removed one', async () => {
    vi.stubGlobal('fetch', photonFetch());
    as('seller');
    expect((await search('shaik')).found.map(p => p.name)).toEqual(['Hyderabad Shaikpet']);   // the default
    await removeExtraArea({ osmType: 'N', osmId: 2935018020 }, 'a@x.co');
    expect((await search('shaik')).found).toEqual([]);
    const p = await pickOf(suburb);
    await addExtraArea({ ref: p.ref, name: 'Hyderabad Shaikpet' }, 'a@x.co');
    const { r, found } = await search('shaik');
    expect(found.map(x => x.name)).toEqual(['Hyderabad Shaikpet']);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
  });
  it('still lets the browser keep the pickup-location search for a few minutes', async () => {
    vi.stubGlobal('fetch', photonFetch());
    as('seller');
    const r = await PLACES(new Request('http://x/api/places?q=udaipur'));
    expect(r.headers.get('cache-control')).toBe('private, max-age=300');
  });
});
