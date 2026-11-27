import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { DELETE, GET, PUT } from '@/app/api/admin/settings/trends/route';
import { resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
const KEY = 'AIzaSyTestKeyForGemini0000001234';
const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
const req = (body: unknown) => new Request('http://x/api', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(async () => { await resetTestDb(); authMock.mockReset(); authMock.mockResolvedValue(null); delete process.env.GEMINI_API_KEY; });

describe('/api/admin/settings/trends', () => {
  it('is admin only', async () => {
    expect((await GET()).status).toBe(401);
    expect((await PUT(req({ apiKey: KEY }))).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    for (const role of ['customer', 'seller']) {
      as(role);
      expect((await GET()).status).toBe(403);
      expect((await PUT(req({ apiKey: KEY }))).status).toBe(403);
      expect((await DELETE()).status).toBe(403);
    }
    as('admin');
    expect((await GET()).status).toBe(200);
    expect((await (await GET()).json()).source).toBe('none'); // the rejected PUTs saved nothing
  });
  it('saves, reads without the key, and removes, and no response ever carries the key', async () => {
    as('admin');
    const put = await PUT(req({ apiKey: KEY, model: 'gemini-test-1.5', region: 'Some region' }));
    expect(put.status).toBe(200);
    expect(put.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(await put.json())).not.toContain(KEY);
    const get = await GET();
    expect(get.headers.get('cache-control')).toBe('no-store');
    const text = await get.text();
    expect(JSON.parse(text)).toEqual({ keySet: true, keyHint: '1234', model: 'gemini-test-1.5', region: 'Some region', source: 'saved', hasStoredRow: true });
    expect(text).not.toContain(KEY);
    const bad = await PUT(req({ apiKey: KEY + ' with spaces', model: 'x' }));
    expect(bad.status).toBe(400);
    expect(JSON.stringify(await bad.json())).not.toContain(KEY);
    const del = await DELETE();
    const delText = await del.text();
    expect(JSON.parse(delText).source).toBe('none');
    expect(delText).not.toContain(KEY);
  });
  it('rejects a bad model and a missing first key with 400', async () => {
    as('admin');
    expect((await PUT(req({ apiKey: KEY, model: 'Bad Model' }))).status).toBe(400);
    const none = await PUT(req({ model: 'gemini-test-1.5' }));
    expect(none.status).toBe(400);
    expect((await none.json()).error).toMatch(/key is required/);
  });
  it('saves model and region with no key when the environment key is set', async () => {
    as('admin');
    process.env.GEMINI_API_KEY = 'env-key-for-gemini-7890';
    try {
      const put = await PUT(req({ model: 'gemini-test-2', region: 'Some region', apiKey: '' }));
      expect(put.status).toBe(200);
      expect(await put.json()).toMatchObject({ source: 'environment', model: 'gemini-test-2', region: 'Some region', hasStoredRow: true });
    } finally { delete process.env.GEMINI_API_KEY; }
  });
});
