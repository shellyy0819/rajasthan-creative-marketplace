import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const revalidate = vi.hoisted(() => vi.fn());
const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate, revalidateTag, unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/trend-fetch', () => ({ runTrendFetch: vi.fn() }));

import { GET as listRoute, POST as fetchRoute } from '@/app/api/admin/trends/route';
import { GET as getOne } from '@/app/api/admin/trends/[id]/route';
import { POST as addRoute } from '@/app/api/admin/trends/[id]/items/route';
import { PATCH as patchRoute } from '@/app/api/admin/trends/[id]/items/[itemId]/route';
import { POST as publishRoute, DELETE as unpublishRoute } from '@/app/api/admin/trends/[id]/publish/route';
import { POST as previewOn, DELETE as previewOff } from '@/app/api/admin/trends/preview/route';
import { ApiError } from '@/lib/errors';
import { runTrendFetch } from '@/lib/trend-fetch';
import { createDigest, getDigest, listDigests } from '@/lib/trend-store';
import type { TrendItem } from '@/lib/trend-types';
import { resetTestDb } from './helpers/testdb';

const runFetch = vi.mocked(runTrendFetch);
const as = (email: string | null, role: string) => authMock.mockResolvedValue(email ? { user: { email, role } } : null);
const asAdmin = () => as('root@x.co', 'admin');
const req = (method: string, body?: unknown, url = 'http://x/api/x') =>
  new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const ctxItem = (id: string, itemId: string) => ({ params: Promise.resolve({ id, itemId }) });
const item = (id: string, over: Partial<TrendItem> = {}): TrendItem => ({
  id, kind: 'craft', title: `Item ${id}`, why: 'Buyers keep asking for this lately.', category: 'Pottery', tags: ['clay'],
  origin: 'web', sources: [{ title: 'Design weekly', url: 'https://example.com/a' }], show: true, ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  kind: 'art', title: 'Miniature painting', why: 'Small framed pieces are selling well.', category: 'Painting', tags: ['miniature'],
  sources: [{ title: 'Art notes' }], origin: 'manual', ...over,
});
const make = (items: TrendItem[] = [item('a')]) => createDigest({ createdBy: 'root@x.co', model: 'test-model', status: 'ok', items });

beforeAll(async () => { await resetTestDb(); }, 30_000);
beforeEach(async () => {
  authMock.mockReset(); authMock.mockResolvedValue(null);
  revalidate.mockReset(); revalidateTag.mockReset(); runFetch.mockReset();
  await resetTestDb();
}, 30_000);

const calls = () => {
  const id = randomUUID();
  return [
    () => listRoute(), () => fetchRoute(),
    () => getOne(req('GET'), ctx(id)),
    () => addRoute(req('POST', input()), ctx(id)),
    () => patchRoute(req('PATCH', { show: true }), ctxItem(id, 'a')),
    () => publishRoute(req('POST'), ctx(id)), () => unpublishRoute(req('DELETE'), ctx(id)),
    () => previewOn(req('POST', { id })), () => previewOff(req('DELETE')),
  ];
};

describe('/api/admin/trends access', () => {
  it('401 anonymous; 403 customer and seller on every route and method, and nothing runs', async () => {
    for (const c of calls()) expect((await c()).status).toBe(401);
    for (const role of ['customer', 'seller']) { as('u@x.co', role); for (const c of calls()) expect((await c()).status).toBe(403); }
    expect(runFetch).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it('403 for a deactivated admin', async () => {
    authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin', active: false } });
    for (const c of calls()) expect((await c()).status).toBe(403);
  });
});

describe('POST /api/admin/trends (fetch)', () => {
  it('runs one fetch as the signed-in admin and returns the digest', async () => {
    asAdmin();
    const d = await make();
    runFetch.mockResolvedValue(d);
    const r = await fetchRoute();
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect((await r.json()).id).toBe(d.id);
    expect(runFetch).toHaveBeenCalledWith('root@x.co');
  });
  it('maps the errors of runTrendFetch to their status and message', async () => {
    asAdmin();
    for (const [status, message] of [[400, 'Add the Gemini key in Settings first.'], [409, 'A fetch is already running.'], [429, 'Wait 30 seconds before fetching again.'], [502, 'The research failed.']] as const) {
      runFetch.mockRejectedValueOnce(new ApiError(status, message));
      const r = await fetchRoute();
      expect(r.status).toBe(status);
      expect(await r.json()).toEqual({ error: message });
    }
    runFetch.mockRejectedValueOnce(new Error('secret detail'));
    const r = await fetchRoute();
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('secret detail');
  });
});

describe('POST /api/admin/trends with manual: true (start a digest by hand)', () => {
  const manual = (body: unknown = { manual: true }) => fetchRoute(req('POST', body));
  it('creates an ok, empty digest made by the admin, without calling the fetch module, and answers 201', async () => {
    asAdmin();
    const r = await manual();
    expect(r.status).toBe(201);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toMatchObject({ status: 'ok', model: 'manual', items: [], error: null, createdBy: 'root@x.co', publishedAt: null });
    expect(runFetch).not.toHaveBeenCalled();
    expect(await listDigests()).toHaveLength(1);
  });
  it('is not held back by the 60 second gap or a running fetch: two in a row both work', async () => {
    asAdmin();
    expect((await manual()).status).toBe(201);
    expect((await manual()).status).toBe(201);
    expect(await listDigests()).toHaveLength(2);
    expect(runFetch).not.toHaveBeenCalled();
  });
  it('stays admin only: 401 anonymous, 403 customer and seller, and nothing is created', async () => {
    expect((await manual()).status).toBe(401);
    for (const role of ['customer', 'seller']) { as('u@x.co', role); expect((await manual()).status).toBe(403); }
    expect(await listDigests()).toHaveLength(0);
    expect(runFetch).not.toHaveBeenCalled();
  });
  it('a manual that is not true or false is a 400 and creates nothing', async () => {
    asAdmin();
    for (const bad of ['true', 1, null, {}, []]) expect((await manual({ manual: bad })).status).toBe(400);
    expect(await listDigests()).toHaveLength(0);
    expect(runFetch).not.toHaveBeenCalled();
  });
  it('manual: false, or no body, or a body without manual, is the normal fetch', async () => {
    asAdmin();
    const d = await make();
    runFetch.mockResolvedValue(d);
    expect((await manual({ manual: false })).status).toBe(201);
    expect((await manual({})).status).toBe(201);
    expect((await fetchRoute(req('POST'))).status).toBe(201);
    expect((await fetchRoute()).status).toBe(201);
    expect(runFetch).toHaveBeenCalledTimes(4);
  });
});

describe('GET /api/admin/trends and /api/admin/trends/[id]', () => {
  it('lists the digests newest first without their items', async () => {
    asAdmin();
    const a = await make([item('a'), item('b', { show: false })]);
    const b = await make([item('c')]);
    const r = await listRoute();
    expect(r.headers.get('cache-control')).toBe('no-store');
    const { digests } = await r.json();
    expect(digests.map((d: { id: string }) => d.id)).toEqual([b.id, a.id]);
    expect(digests[1]).toMatchObject({ itemCount: 2, shownCount: 1 });
    expect(digests[1]).not.toHaveProperty('items');
  });
  it('reads one digest with its items matched to what we have', async () => {
    asAdmin();
    const d = await make([item('a'), item('w', { kind: 'workshop', title: 'Clay day', category: undefined, tags: [] })]);
    const r = await getOne(req('GET'), ctx(d.id));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const out = await r.json();
    expect(out.digest.id).toBe(d.id);
    expect(out.digest.items).toHaveLength(2);
    expect(out.matched.map((m: { id: string }) => m.id)).toEqual(['a', 'w']);
    expect(out.matched[0]).toMatchObject({ count: expect.any(Number), href: expect.stringMatching(/^\/shop/) });
    expect(out.matched[1]).toMatchObject({ count: 0, href: '/workshops' });
  });
  it('404 for an unknown and for a malformed id', async () => {
    asAdmin();
    expect((await getOne(req('GET'), ctx(randomUUID()))).status).toBe(404);
    expect((await getOne(req('GET'), ctx('nope'))).status).toBe(404);
  });
});

describe('POST /api/admin/trends/[id]/items', () => {
  it('adds a hidden item with the origin given and returns the digest', async () => {
    asAdmin();
    const d = await make();
    for (const origin of ['pinterest', 'manual']) {
      const r = await addRoute(req('POST', input({ origin })), ctx(d.id));
      expect(r.status).toBe(201);
    }
    const added = (await getDigest(d.id))!.items.slice(1);
    expect(added.map(i => i.origin)).toEqual(['pinterest', 'manual']);
    expect(added.every(i => i.show === false)).toBe(true);
    const r = await addRoute(req('POST', input({ origin: 'manual', id: 'x', show: true })), ctx(d.id));
    const out = await r.json();
    expect(out.items.at(-1)).toMatchObject({ show: false });
    expect(out.items.at(-1).id).not.toBe('x');
  });
  it('rejects an origin that is not pinterest or manual, or is missing, with 400', async () => {
    asAdmin();
    const d = await make();
    for (const origin of ['web', 'PINTEREST', 'other', 7, null, undefined]) {
      expect((await addRoute(req('POST', input({ origin })), ctx(d.id))).status).toBe(400);
    }
    expect((await getDigest(d.id))!.items).toHaveLength(1);
  });
  it('400 for a bad body, 404 for an unknown digest, 409 for a published digest', async () => {
    asAdmin();
    const d = await make();
    expect((await addRoute(req('POST', input({ title: 'x' })), ctx(d.id))).status).toBe(400);
    expect((await addRoute(req('POST', input({ sources: [] })), ctx(d.id))).status).toBe(400);
    expect((await addRoute(req('POST', [1]), ctx(d.id))).status).toBe(400);
    expect((await addRoute(req('POST', input()), ctx(randomUUID()))).status).toBe(404);
    expect((await publishRoute(req('POST'), ctx(d.id))).status).toBe(200);
    expect((await addRoute(req('POST', input()), ctx(d.id))).status).toBe(409);
  });
});

describe('PATCH /api/admin/trends/[id]/items/[itemId]', () => {
  it('changes the whitelisted fields and returns the digest', async () => {
    asAdmin();
    const d = await make([item('a', { show: false })]);
    const r = await patchRoute(req('PATCH', { show: true, kind: 'art', title: 'New title', why: 'A new reason that is long enough.', category: 'Weaving', tags: ['loom'], sources: [{ title: 'Other source' }] }), ctxItem(d.id, 'a'));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect((await r.json()).items[0]).toMatchObject({ id: 'a', show: true, kind: 'art', title: 'New title', category: 'Weaving', tags: ['loom'], sources: [{ title: 'Other source' }], origin: 'web' });
  });
  it('never lets id or origin through', async () => {
    asAdmin();
    const d = await make([item('a')]);
    const r = await patchRoute(req('PATCH', { id: 'z', origin: 'manual', title: 'Still allowed' }), ctxItem(d.id, 'a'));
    expect(r.status).toBe(200);
    expect((await getDigest(d.id))!.items[0]).toMatchObject({ id: 'a', origin: 'web', title: 'Still allowed' });
  });
  it('400 for bad values, 404 for an unknown item or digest, 409 for a published digest', async () => {
    asAdmin();
    const d = await make([item('a')]);
    for (const b of [{ show: 'yes' }, { kind: 'toy' }, { title: 'x' }, { tags: 'a' }, { sources: [] }, [1]]) {
      expect((await patchRoute(req('PATCH', b), ctxItem(d.id, 'a'))).status).toBe(400);
    }
    expect((await patchRoute(req('PATCH', { show: false }), ctxItem(d.id, 'nope'))).status).toBe(404);
    expect((await patchRoute(req('PATCH', { show: false }), ctxItem(randomUUID(), 'a'))).status).toBe(404);
    expect((await publishRoute(req('POST'), ctx(d.id))).status).toBe(200);
    expect((await patchRoute(req('PATCH', { show: false }), ctxItem(d.id, 'a'))).status).toBe(409);
    expect((await getDigest(d.id))!.items[0].show).toBe(true);
  });
});

describe('publish and unpublish', () => {
  it('publish responds with the digest, revalidates /trending, and replaces the previous one', async () => {
    asAdmin();
    const a = await make(); const b = await make([item('b')]);
    const r = await publishRoute(req('POST'), ctx(a.id));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toMatchObject({ id: a.id, publishedBy: 'root@x.co' });
    expect(revalidate).toHaveBeenCalledWith('/trending');
    expect(revalidateTag).toHaveBeenCalledWith('trends', { expire: 0 });
    expect((await publishRoute(req('POST'), ctx(b.id))).status).toBe(200);
    expect((await getDigest(a.id))!.publishedAt).toBeNull();
    expect((await getDigest(b.id))!.publishedAt).not.toBeNull();
  });
  it('publish refuses a digest with nothing shown (400) or unknown (404) and does not revalidate', async () => {
    asAdmin();
    const d = await make([item('a', { show: false })]);
    expect((await publishRoute(req('POST'), ctx(d.id))).status).toBe(400);
    expect((await publishRoute(req('POST'), ctx(randomUUID()))).status).toBe(404);
    expect(revalidate).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it('unpublish responds with the digest and revalidates /trending', async () => {
    asAdmin();
    const d = await make();
    await publishRoute(req('POST'), ctx(d.id));
    revalidate.mockClear(); revalidateTag.mockClear();
    const r = await unpublishRoute(req('DELETE'), ctx(d.id));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id: d.id, publishedAt: null, publishedBy: null });
    expect(revalidate).toHaveBeenCalledWith('/trending');
    expect(revalidateTag).toHaveBeenCalledWith('trends', { expire: 0 });
    expect((await unpublishRoute(req('DELETE'), ctx(randomUUID()))).status).toBe(404);
  });
});

describe('/api/admin/trends/preview', () => {
  it('sets an HttpOnly, SameSite=lax, Path=/ cookie for an existing digest, Secure on https', async () => {
    asAdmin();
    const d = await make();
    const r = await previewOn(req('POST', { id: d.id }));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const c = r.headers.get('set-cookie')!;
    expect(c).toContain(`rr_trend_preview=${d.id}`);
    for (const part of ['Path=/', 'HttpOnly', 'SameSite=lax']) expect(c).toContain(part);
    expect(c).not.toContain('Secure');
    expect(c).not.toMatch(/Max-Age|Expires/i);
    const s = await previewOn(req('POST', { id: d.id }, 'https://x/api/x'));
    expect(s.headers.get('set-cookie')).toContain('Secure');
    const f = await previewOn(new Request('http://x/api/x', { method: 'POST', body: JSON.stringify({ id: d.id }), headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' } }));
    expect(f.headers.get('set-cookie')).toContain('Secure');
  });
  it('400 for a malformed id and 404 for an unknown one, and sets no cookie', async () => {
    asAdmin();
    for (const id of ['nope', 5, null, undefined, '../x']) {
      const r = await previewOn(req('POST', { id }));
      expect(r.status).toBe(400);
      expect(r.headers.get('set-cookie')).toBeNull();
    }
    const r = await previewOn(req('POST', { id: randomUUID() }));
    expect(r.status).toBe(404);
    expect(r.headers.get('set-cookie')).toBeNull();
  });
  it('DELETE clears the cookie with Max-Age=0', async () => {
    asAdmin();
    const r = await previewOff(req('DELETE'));
    expect(r.status).toBe(200);
    const c = r.headers.get('set-cookie')!;
    expect(c).toContain('rr_trend_preview=;');
    expect(c).toContain('Max-Age=0');
    expect(c).toContain('Path=/');
  });
});
