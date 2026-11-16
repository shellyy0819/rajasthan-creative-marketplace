import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate, revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

import { POST as REQUEST } from '@/app/api/city-requests/route';
import { GET as LIST } from '@/app/api/admin/city-requests/route';
import { PATCH as DECIDE } from '@/app/api/admin/city-requests/[id]/route';
import { GET as PLACES, resetPlacesRateLimit } from '@/app/api/places/route';
import { signCityRef, verifyCityRef } from '@/lib/city-ref';
import { DAILY_LIMIT, GLOBAL_DAILY_LIMIT, cityRequestMail, createCityRequest, decideCityRequest, listCityRequests } from '@/lib/city-requests';
import { addExtraArea, getExtraAreas, removeExtraArea } from '@/lib/extra-areas';
import { DEFAULT_EXTRA_AREAS, SELLER_AREA_LIMIT } from '@/lib/extra-areas-shared';
import { setMailSenderForTests, type Mail } from '@/lib/mailer';
import { clearPlacesCache, searchPlacesToRequest } from '@/lib/places';
import { getTestDb, resetTestDb } from './helpers/testdb';
import { appSettings } from '../src/db/schema';

const SELLER = { email: 'seller@x.co', name: 'Lakshmi Bandhani' };
const ref = (over: Partial<Parameters<typeof signCityRef>[0]> = {}) => signCityRef({ osmType: 'N', osmId: 424242, name: 'Nampally', state: 'Telangana', lat: 17.39, lng: 78.47, ...over });
const sent: Mail[] = [];
const as = (email: string, role: string) => authMock.mockResolvedValue({ user: { email, role, name: 'Someone' } });
const jsonReq = (method: string, body?: unknown, url = 'http://x/api') => new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(async () => {
  await resetTestDb(); clearPlacesCache(); resetPlacesRateLimit(); sent.length = 0; revalidate.mockReset(); authMock.mockReset(); authMock.mockResolvedValue(null);
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret'); vi.stubEnv('ADMIN_EMAILS', 'boss@x.co');
  setMailSenderForTests(async m => { sent.push(m); });
});
afterEach(() => { setMailSenderForTests(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('a seller adds a city', () => {
  it('is live at once: offered in the City field, saved for review, and the seller gets a fresh reference to pick it with', async () => {
    const r = await createCityRequest({ ref: ref(), name: 'Hyderabad Nampally', note: 'Our workshop is here.' }, SELLER);
    expect(r.alreadyThere).toBe(false);
    expect(r.place).toMatchObject({ label: 'Hyderabad Nampally, Telangana', name: 'Hyderabad Nampally', state: 'Telangana' });
    expect(verifyCityRef(r.place.ref)).toMatchObject({ name: 'Hyderabad Nampally', osmType: 'N', osmId: 424242 });
    expect((await getExtraAreas()).map(a => a.name)).toContain('Hyderabad Nampally');
    expect(await listCityRequests()).toEqual([expect.objectContaining({ name: 'Hyderabad Nampally', status: 'live', requestedBy: 'seller@x.co', requestedByName: 'Lakshmi Bandhani', note: 'Our workshop is here.', placeLabel: 'Nampally, Telangana' })]);
  });
  it('emails the team (hello.craftofy@gmail.com and the admins) for information: who, what, and where to change it', async () => {
    await createCityRequest({ ref: ref(), name: 'Hyderabad Nampally', note: 'Hi' }, SELLER);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(expect.arrayContaining(['hello.craftofy@gmail.com', 'boss@x.co']));
    expect(sent[0].replyTo).toBe('seller@x.co');
    expect(sent[0].subject).toBe('New city request (auto-approved): Hyderabad Nampally, Telangana, by Lakshmi Bandhani');
    expect(sent[0].text).toMatch(/For your information: Lakshmi Bandhani \(seller@x\.co\) created a new city request/); expect(sent[0].text).toMatch(/approved automatically/); expect(sent[0].text).toMatch(/Nothing needs doing/); expect(sent[0].text).toMatch(/Dashboard > City requests/); expect(sent[0].text).toMatch(/Note from the seller: Hi/);
  });
  it('still works when the email cannot be sent', async () => {
    setMailSenderForTests(async () => { throw new Error('smtp down'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await createCityRequest({ ref: ref(), name: 'Hyderabad Nampally' }, SELLER);
    expect(r.place.name).toBe('Hyderabad Nampally'); expect(await listCityRequests()).toHaveLength(1); spy.mockRestore();
  });
  it('picking a place that is already offered changes nothing and sends nothing', async () => {
    const [d] = DEFAULT_EXTRA_AREAS;
    const r = await createCityRequest({ ref: signCityRef(d) }, SELLER);
    expect(r.alreadyThere).toBe(true); expect(r.place.name).toBe('Hyderabad Shaikpet');
    expect(await listCityRequests()).toEqual([]); expect(sent).toEqual([]);
  });
  it('keeps the place\'s own name when no name is given, and rejects a bad reference, name or note', async () => {
    expect((await createCityRequest({ ref: ref() }, SELLER)).place.name).toBe('Nampally');
    await expect(createCityRequest({ ref: ref({ osmId: 1 }) + 'x', name: 'Yy' }, SELLER)).rejects.toMatchObject({ status: 400 });
    await expect(createCityRequest({ name: 'Yy' }, SELLER)).rejects.toMatchObject({ status: 400 });
    await expect(createCityRequest({ ref: ref({ osmId: 2 }), name: 'H' }, SELLER)).rejects.toMatchObject({ status: 400 });
    await expect(createCityRequest({ ref: ref({ osmId: 3 }), name: 'Fine', note: 'x'.repeat(301) }, SELLER)).rejects.toMatchObject({ status: 400 });
  });
  it('limits one seller to 10 a day', async () => {
    for (let i = 0; i < DAILY_LIMIT; i++) await createCityRequest({ ref: ref({ osmId: 1000 + i, name: `Place ${i}` }), name: `Place ${i}` }, SELLER);
    await expect(createCityRequest({ ref: ref({ osmId: 9999 }), name: 'One more' }, SELLER)).rejects.toMatchObject({ status: 429 });
    await expect(createCityRequest({ ref: ref({ osmId: 9999 }), name: 'One more' }, { email: 'other@x.co' })).resolves.toBeTruthy();
  });
  it('writes the email so a plain-text reader gets the facts', () => {
    const m = cityRequestMail({ id: 'i', requestedBy: 'a@x.co', name: 'X Y', placeLabel: 'Y', status: 'live', createdAt: '2026-11-16T00:00:00Z' });
    expect(m.text).toMatch(/a@x\.co created a new city request/); expect(m.subject).toBe('New city request (auto-approved): X Y, by a@x.co');
  });
});

describe('what stops it being misused', () => {
  const place = (i: number) => ref({ osmId: 7000 + i, name: `Place ${i}` });
  it('a place the admin removed stays removed: asking again does not put it back', async () => {
    const { request } = await createCityRequest({ ref: place(1), name: 'Place 1' }, SELLER);
    await decideCityRequest(request!.id, { decision: 'remove' }, 'boss@x.co');
    await expect(createCityRequest({ ref: place(1), name: 'Place 1' }, { email: 'other@x.co' })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/removed this place.*write to us/) });
    expect((await getExtraAreas()).some(a => a.osmId === 7001)).toBe(false);
    await decideCityRequest(request!.id, { decision: 'approve' }, 'boss@x.co');   // the admin restores it
    expect((await createCityRequest({ ref: place(1) }, { email: 'other@x.co' })).alreadyThere).toBe(true);
  });
  it('removing a seller\'s city from the Settings screen counts as removing the request too', async () => {
    await createCityRequest({ ref: place(2), name: 'Place 2' }, SELLER);
    await removeExtraArea({ osmType: 'N', osmId: 7002 }, 'boss@x.co');
    expect((await listCityRequests())[0]).toMatchObject({ status: 'removed', decidedBy: 'boss@x.co' });
    await expect(createCityRequest({ ref: place(2) }, { email: 'other@x.co' })).rejects.toMatchObject({ status: 409 });
  });
  it('all sellers together can add at most 50 a day', async () => {
    for (let i = 0; i < GLOBAL_DAILY_LIMIT; i++) await createCityRequest({ ref: place(100 + i), name: `Place ${100 + i}` }, { email: `s${i % 10}@x.co` });
    await expect(createCityRequest({ ref: place(999), name: 'Place 999' }, { email: 'fresh@x.co' })).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/Many places were added today/) });
  });
  it('sellers cannot fill the list: the last places are kept for the admin', async () => {
    const many = Array.from({ length: SELLER_AREA_LIMIT }, (_, i) => ({ name: `Area ${i}`, osmType: 'N', osmId: 100_000 + i, lat: 10, lng: 70, aliases: [] }));
    await (await getTestDb()).insert(appSettings).values({ key: 'extra-areas', value: { areas: many }, updatedBy: 'a@x.co' });
    await expect(createCityRequest({ ref: place(3), name: 'Place 3' }, SELLER)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/list is full for now/) });
    expect((await addExtraArea({ ref: place(3), name: 'Place 3' }, 'boss@x.co')).length).toBe(SELLER_AREA_LIMIT + 1);   // the admin still can
  });
  it('requests at the same moment all land, and cannot slip past the daily limit', async () => {
    await Promise.all([10, 11, 12, 13, 14, 15].map(i => createCityRequest({ ref: place(i), name: `Place ${i}` }, { email: `p${i}@x.co` })));
    expect((await listCityRequests()).length).toBe(6);
    const names = (await getExtraAreas()).map(a => a.name);
    for (const i of [10, 11, 12, 13, 14, 15]) expect(names).toContain(`Place ${i}`);
    const results = await Promise.allSettled(Array.from({ length: DAILY_LIMIT + 4 }, (_, i) => createCityRequest({ ref: place(300 + i), name: `Place ${300 + i}` }, { email: 'same@x.co' })));
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(DAILY_LIMIT);
  });
});

describe('the admin decides', () => {
  it('keeps a request, or removes its place from the City field, and either can be undone', async () => {
    const { request } = await createCityRequest({ ref: ref(), name: 'Hyderabad Nampally' }, SELLER);
    const id = request!.id, present = async () => (await getExtraAreas()).some(a => a.osmId === 424242);
    expect(await decideCityRequest(id, { decision: 'approve' }, 'boss@x.co')).toMatchObject({ status: 'approved', decidedBy: 'boss@x.co' });
    expect(await present()).toBe(true);
    expect(await decideCityRequest(id, { decision: 'remove' }, 'boss@x.co')).toMatchObject({ status: 'removed' });
    expect(await present()).toBe(false);
    expect(await decideCityRequest(id, { decision: 'approve' }, 'boss@x.co')).toMatchObject({ status: 'approved' });
    expect(await present()).toBe(true);
    expect((await getExtraAreas()).find(a => a.osmId === 424242)!.name).toBe('Hyderabad Nampally');
  });
  it('removing when the place is already gone from the list still records the decision', async () => {
    const { request } = await createCityRequest({ ref: ref(), name: 'Hyderabad Nampally' }, SELLER);
    await decideCityRequest(request!.id, { decision: 'remove' }, 'boss@x.co');
    await expect(decideCityRequest(request!.id, { decision: 'remove' }, 'boss@x.co')).resolves.toMatchObject({ status: 'removed' });
  });
  it('rejects an unknown decision or request', async () => {
    const { request } = await createCityRequest({ ref: ref() }, SELLER);
    await expect(decideCityRequest(request!.id, { decision: 'maybe' }, 'b@x.co')).rejects.toMatchObject({ status: 400 });
    await expect(decideCityRequest('not-an-id', { decision: 'approve' }, 'b@x.co')).rejects.toMatchObject({ status: 404 });
    await expect(decideCityRequest('00000000-0000-4000-8000-000000000000', { decision: 'approve' }, 'b@x.co')).rejects.toMatchObject({ status: 404 });
  });
});

describe('API', () => {
  const call = (id: string, body: unknown) => DECIDE(jsonReq('PATCH', body), { params: Promise.resolve({ id }) });
  it('adding a city is for sellers and admins only', async () => {
    expect((await REQUEST(jsonReq('POST', { ref: ref() }))).status).toBe(401);
    as('c@x.co', 'customer'); expect((await REQUEST(jsonReq('POST', { ref: ref() }))).status).toBe(403);
    expect(await listCityRequests()).toEqual([]);
    as('seller@x.co', 'seller');
    const res = await REQUEST(jsonReq('POST', { ref: ref(), name: 'Hyderabad Nampally' }));
    expect(res.status).toBe(201); expect(((await res.json()) as { place: { name: string }; alreadyThere: boolean })).toMatchObject({ place: { name: 'Hyderabad Nampally' }, alreadyThere: false });
    expect(revalidate).toHaveBeenCalled();
    expect((await REQUEST(jsonReq('POST', { ref: ref(), name: 'Hyderabad Nampally' }))).status).toBe(200);   // again: already there
  });
  it('reviewing is for admins only', async () => {
    as('seller@x.co', 'seller');
    const { request } = await createCityRequest({ ref: ref() }, SELLER);
    expect((await LIST()).status).toBe(403); expect((await call(request!.id, { decision: 'remove' })).status).toBe(403);
    authMock.mockResolvedValue(null); expect((await LIST()).status).toBe(401);
    as('boss@x.co', 'admin');
    expect(((await (await LIST()).json()) as unknown[]).length).toBe(1);
    expect((await call(request!.id, { decision: 'remove' })).status).toBe(200);
    expect((await call(request!.id, { decision: 'nope' })).status).toBe(400);
  });
});

describe('the place search for a seller adding a city', () => {
  const f = (props: Record<string, unknown>) => ({ properties: { countrycode: 'IN', state: 'Telangana', osm_type: 'N', osm_id: 5, ...props }, geometry: { coordinates: [78.4, 17.4] } });
  const photon = (...features: unknown[]) => vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ features }) } as Response));
  it('offers cities, towns, villages, hamlets, suburbs and neighbourhoods, each with a reference, and nothing else', async () => {
    const found = await searchPlacesToRequest('xyz', photon(f({ name: 'A', osm_value: 'city' }), f({ name: 'B', osm_value: 'hamlet' }), f({ name: 'C', osm_value: 'suburb' }), f({ name: 'D', osm_value: 'neighbourhood' }), f({ name: 'E', osm_value: 'primary' }), f({ name: 'F', osm_value: 'pond' })) as never);
    expect(found.map(p => p.name).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(found.every(p => !!p.ref)).toBe(true);
  });
  it('is for signed-in users and is not kept by the browser', async () => {
    vi.stubGlobal('fetch', photon(f({ name: 'Nampally', osm_value: 'suburb' })));
    expect((await PLACES(new Request('http://x/api/places?q=nampally&type=request'))).status).toBe(401);
    as('seller@x.co', 'seller');
    const r = await PLACES(new Request('http://x/api/places?q=nampally&type=request'));
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(((await r.json()) as { name: string }[]).map(p => p.name)).toEqual(['Nampally']);
  });
});
