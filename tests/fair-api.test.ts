import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { POST as PRESENCE } from '@/app/api/fair/presence/route';
import { GET, PUT } from '@/app/api/admin/settings/fair/route';
import { getFairSettings } from '@/lib/fair-settings';
import { resetTestDb } from './helpers/testdb';

const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('http://x/api/fair/presence', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA, 'x-forwarded-for': '203.0.113.7', ...headers }, body: JSON.stringify(body) });
const put = (body: unknown) => new Request('http://x/api', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
beforeEach(async () => { await resetTestDb(); authMock.mockReset(); authMock.mockResolvedValue(null); });

describe('POST /api/fair/presence', () => {
  it('needs no sign-in and answers with the others and the head count', async () => {
    await PRESENCE(post({ code: 'AAAAAA', x: 5, y: 300, facing: 'up' }));
    const res = await PRESENCE(post({ code: 'BBBBBB', x: 9, y: 301, facing: 'left' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.visitors).toEqual([expect.objectContaining({ code: 'AAAAAA', x: 5, y: 300, facing: 'up' })]);
  });
  it('rejects bad input with a specific message', async () => {
    const res = await PRESENCE(post({ code: 'nope', x: 1, y: 1, facing: 'up' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/code/);
  });
  it('turns crawlers away', async () => {
    expect((await PRESENCE(post({ code: 'CCCCCC', x: 1, y: 1, facing: 'up' }, { 'user-agent': 'Googlebot/2.1' }))).status).toBe(403);
  });
  it('limits how fast one code can send heartbeats', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 14; i++) codes.push((await PRESENCE(post({ code: 'DDDDDD', x: 1, y: 1, facing: 'up' }, { 'x-forwarded-for': `198.51.100.${i}` }))).status);
    expect(codes.slice(0, 12).every(s => s === 200)).toBe(true);
    expect(codes.slice(12)).toEqual([429, 429]);
  });
});

describe('fair settings', () => {
  it('defaults to sample makers', async () => { expect(await getFairSettings()).toEqual({ source: 'sample' }); });
  it('is admin only', async () => {
    expect((await GET()).status).toBe(401);
    for (const role of ['customer', 'seller']) { as(role); expect((await GET()).status).toBe(403); expect((await PUT(put({ source: 'real' }))).status).toBe(403); }
  });
  it('saves the switch and reads it back', async () => {
    as('admin');
    expect((await PUT(put({ source: 'real' }))).status).toBe(200);
    expect(await (await GET()).json()).toEqual({ source: 'real' });
    expect(await getFairSettings()).toEqual({ source: 'real' });
    expect((await PUT(put({ source: 'sample' }))).status).toBe(200);
    expect(await getFairSettings()).toEqual({ source: 'sample' });
  });
  it('rejects anything else', async () => {
    as('admin');
    expect((await PUT(put({ source: 'both' }))).status).toBe(400);
    expect((await PUT(put({}))).status).toBe(400);
  });
});
