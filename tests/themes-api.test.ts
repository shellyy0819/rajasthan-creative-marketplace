import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET as listRoute, POST as createRoute } from '@/app/api/admin/themes/route';
import { GET as getOne, PATCH as patchOne, DELETE as deleteOne } from '@/app/api/admin/themes/[id]/route';
import { POST as scheduleRoute, DELETE as unscheduleRoute } from '@/app/api/admin/themes/[id]/schedule/route';
import { POST as endRoute } from '@/app/api/admin/themes/[id]/end/route';
import { GET as getBaseRoute, PATCH as patchBase } from '@/app/api/admin/themes/base/route';
import { POST as previewOn, DELETE as previewOff } from '@/app/api/admin/themes/preview/route';
import { PRESETS } from '@/lib/themes/presets';
import { dateToIst } from '@/lib/themes/ist';
import { clearThemeCache } from '@/lib/themes/store';
import { giveRole, resetTestDb } from './helpers/testdb';

const as = (email: string | null, role: string) => authMock.mockResolvedValue(email ? { user: { email, role } } : null);
const asAdmin = () => as('root@x.co', 'admin');
const req = (method: string, body?: unknown) => new Request('http://x/api/x', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const body = async (r: Response) => r.json();

beforeAll(async () => { await resetTestDb(); }, 30_000);
beforeEach(async () => {
  authMock.mockReset(); authMock.mockResolvedValue(null);
  process.env.ADMIN_EMAILS = '';
  await resetTestDb(); clearThemeCache();
  await giveRole('root@x.co', 'admin');
});

const calls = () => [
  () => listRoute(), () => createRoute(req('POST', { preset: 'diwali' })),
  () => getOne(req('GET'), ctx(1)), () => patchOne(req('PATCH', {}), ctx(1)), () => deleteOne(req('DELETE'), ctx(1)),
  () => scheduleRoute(req('POST'), ctx(1)), () => unscheduleRoute(req('DELETE'), ctx(1)), () => endRoute(req('POST'), ctx(1)),
  () => getBaseRoute(), () => patchBase(req('PATCH', { config: {} })),
  () => previewOn(req('POST', { id: 1 })), () => previewOff(req('DELETE')),
];

describe('/api/admin/themes access', () => {
  it('401 anonymous; 403 customer and seller on every route', async () => {
    for (const c of calls()) expect((await c()).status).toBe(401);
    for (const role of ['customer', 'seller']) { as('u@x.co', role); for (const c of calls()) expect((await c()).status).toBe(403); }
  });
});

describe('/api/admin/themes flow', () => {
  it('create, patch, schedule, end, delete', async () => {
    asAdmin();
    const empty = await listRoute();
    expect(empty.headers.get('cache-control')).toBe('no-store');
    const l0 = await body(empty);
    expect(l0.themes).toEqual([]); expect(l0.live).toBeNull();
    expect(l0.base.state).toBe('base'); expect(l0.base.preset).toBe('everyday');

    const c = await createRoute(req('POST', { preset: 'christmas' }));
    expect(c.status).toBe(201);
    const t = await body(c);
    expect(t).toMatchObject({ preset: 'christmas', label: PRESETS.christmas.label, state: 'draft', effectivePrimary: PRESETS.christmas.primary, startsAtIst: PRESETS.christmas.sample!.startsAt, endsAtIst: PRESETS.christmas.sample!.endsAt, updatedBy: 'root@x.co' });
    expect((await createRoute(req('POST', { preset: 'nope' }))).status).toBe(400);

    const now = Date.now();
    const p = await patchOne(req('PATCH', { config: { ...t.config, primary: '#0F5132', banner: 'Merry!' }, startsAtIst: dateToIst(new Date(now - 3_600_000)), endsAtIst: dateToIst(new Date(now + 3_600_000)) }), ctx(t.id));
    expect(p.status).toBe(200);
    const pd = await body(p);
    expect(pd.config.banner).toBe('Merry!'); expect(pd.effectivePrimary).toBe('#0F5132');

    const s = await scheduleRoute(req('POST'), ctx(t.id));
    expect(s.status).toBe(200);
    expect((await body(s)).state).toBe('live');
    expect((await body(await listRoute())).live).toBe(t.id);

    const e = await endRoute(req('POST'), ctx(t.id));
    expect(e.status).toBe(200);
    expect((await body(e)).state).toBe('ended');
    expect((await body(await listRoute())).live).toBeNull();
    expect((await endRoute(req('POST'), ctx(t.id))).status).toBe(409);

    const u = await unscheduleRoute(req('DELETE'), ctx(t.id));
    expect((await body(u)).state).toBe('draft');
    expect((await body(await getOne(req('GET'), ctx(t.id)))).id).toBe(t.id);

    expect((await deleteOne(req('DELETE'), ctx(t.id))).status).toBe(200);
    expect((await getOne(req('GET'), ctx(t.id))).status).toBe(404);
    expect((await deleteOne(req('DELETE'), ctx(t.id))).status).toBe(404);
    expect((await getOne(req('GET'), ctx('abc'))).status).toBe(404);
  });

  it('rejects scheduling without dates (400) and end-now on a draft (409)', async () => {
    asAdmin();
    const t = await body(await createRoute(req('POST', { preset: 'everyday' })));
    expect((await scheduleRoute(req('POST'), ctx(t.id))).status).toBe(400);
    expect((await endRoute(req('POST'), ctx(t.id))).status).toBe(409);
    expect((await scheduleRoute(req('POST'), ctx(9999))).status).toBe(404);
  });

  it('invalid PATCH bodies return 400 with a message and leave the row unchanged', async () => {
    asAdmin();
    const t = await body(await createRoute(req('POST', { preset: 'diwali' })));
    const bad: unknown[] = [
      { config: { ...t.config, stickers: [{ id: 'nope', x: 0, y: 0, s: 1 }] } },
      { config: { ...t.config, stickers: [{ id: t.config.stickers[0]?.id ?? 'dfire', x: 301, y: 0, s: 1 }] } },
      { config: { ...t.config, stickers: [{ id: 'dfire', x: 0, y: 0, s: 5 }] } },
      { config: { ...t.config, banner: 'x'.repeat(61) } },
      { config: { ...t.config, primary: 'red' } },
      { config: { ...t.config, primary: '#fff;}body{display:none' } },
      { config: { ...t.config, primary: '#7F7F7F' } },
      { startsAtIst: 'garbage' },
      { startsAtIst: '2030-01-02T00:00', endsAtIst: '2030-01-01T00:00' },
    ];
    for (const b of bad) {
      const r = await patchOne(req('PATCH', b), ctx(t.id));
      expect(r.status, JSON.stringify(b)).toBe(400);
      expect(typeof (await body(r)).error).toBe('string');
    }
    const after = await body(await getOne(req('GET'), ctx(t.id)));
    expect(after).toEqual(t);
  });

  it('PATCH base updates Everyday', async () => {
    asAdmin();
    const b = await body(await getBaseRoute());
    expect(b.state).toBe('base');
    const r = await patchBase(req('PATCH', { config: { ...b.config, banner: 'Hello there' } }));
    expect(r.status).toBe(200);
    expect((await body(r)).config.banner).toBe('Hello there');
    expect((await body(await getBaseRoute())).config.banner).toBe('Hello there');
    expect((await patchBase(req('PATCH', {}))).status).toBe(400);
  });
});

describe('/api/admin/themes/preview', () => {
  it('POST sets the cookie, DELETE clears it, unknown id is 404', async () => {
    asAdmin();
    const t = await body(await createRoute(req('POST', { preset: 'diwali' })));
    const on = await previewOn(req('POST', { id: t.id }));
    expect(on.status).toBe(200);
    const sc = on.headers.get('set-cookie')!;
    expect(sc).toContain(`rr_theme_preview=${t.id}`);
    expect(sc).toMatch(/HttpOnly/i); expect(sc).toMatch(/SameSite=lax/i); expect(sc).toMatch(/Path=\//);
    expect(sc).not.toMatch(/Max-Age|Expires/i);
    expect((await previewOn(req('POST', { id: 99999 }))).status).toBe(404);
    expect((await previewOn(req('POST', { id: 'x' }))).status).toBe(400);
    const off = await previewOff(req('DELETE'));
    expect(off.headers.get('set-cookie')).toMatch(/rr_theme_preview=;|rr_theme_preview=; /);
    expect(off.headers.get('set-cookie')).toMatch(/Max-Age=0|Expires=/i);
  });
});
