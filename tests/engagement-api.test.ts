import { describe, it, expect, beforeEach, vi } from 'vitest';
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
import { POST as likePost, DELETE as likeDelete } from '@/app/api/products/[id]/like/route';
import { GET as likesGet } from '@/app/api/likes/route';
import { POST as eventsPost } from '@/app/api/events/route';
import { resetLimitersForTests } from '@/lib/engagement-limits';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { productEvents, productLikes } from '@/db/schema';
import { createProduct } from '@/lib/admin';
import { admin } from './helpers/actors';

const VID = 'b3d9f2c0-5a1e-4c2b-9d3e-7f6a8b9c0d1e';
const JSON_H = { 'content-type': 'application/json' };
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const like = (id: string, headers: Record<string, string> = JSON_H, method: 'POST' | 'DELETE' = 'POST') =>
  (method === 'POST' ? likePost : likeDelete)(new Request(`http://x/api/products/${id}/like`, { method, headers, body: '{}' }), ctx(id));
const event = (body: unknown, headers: Record<string, string> = { ...JSON_H, 'user-agent': BROWSER, 'x-forwarded-for': '1.2.3.4' }) =>
  eventsPost(new Request('http://x/api/events', { method: 'POST', headers, body: JSON.stringify(body) }));

beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); resetLimitersForTests(); await resetTestDb(); });

describe('POST/DELETE /api/products/:id/like', () => {
  it('an anonymous visitor can like: the first call sets a visitor cookie, the second (with the cookie) is the same like', async () => {
    const r1 = await like('p1');
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ liked: true, count: 1 });
    const cookie = r1.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^rr_vid=[0-9a-f-]{36}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax/);
    const vid = /rr_vid=([^;]+)/.exec(cookie)![1];
    const r2 = await like('p1', { ...JSON_H, cookie: `rr_vid=${vid}` });
    expect(await r2.json()).toEqual({ liked: true, count: 1 });
    expect(r2.headers.get('set-cookie')).toBeNull();                       // already has one
    const unlike = await like('p1', { ...JSON_H, cookie: `rr_vid=${vid}` }, 'DELETE');
    expect(await unlike.json()).toEqual({ liked: false, count: 0 });
  });
  it('a forged or malformed cookie is replaced, never trusted as an identity', async () => {
    const r = await like('p1', { ...JSON_H, cookie: 'rr_vid=../../admin' });
    expect(r.headers.get('set-cookie')).toMatch(/rr_vid=[0-9a-f-]{36}/);
  });
  it('a signed-in user likes as themselves: the same account on two browsers counts once', async () => {
    authMock.mockResolvedValue({ user: { email: 'Me@X.co', role: 'customer' } });
    await like('p1'); await like('p1', { ...JSON_H, cookie: `rr_vid=${VID}` });
    const rows = await (await getTestDb()).select().from(productLikes);
    expect(rows.map(r => r.actor)).toEqual(['u:me@x.co']);
  });
  it('a deactivated account falls back to an anonymous visitor', async () => {
    authMock.mockResolvedValue({ user: { email: 'off@x.co', role: 'seller', active: false } });
    await like('p1');
    expect((await (await getTestDb()).select().from(productLikes))[0].actor).toMatch(/^v:/);
  });
  it('an auth failure (missing secret) must not break liking for anonymous visitors', async () => {
    authMock.mockRejectedValue(new Error('NEXTAUTH_SECRET is not set'));
    expect((await like('p1')).status).toBe(200);
  });
  it('requires a JSON content type (415) so a cross-site form post cannot like', async () => {
    expect((await like('p1', { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await like('p1', {})).status).toBe(415);
    expect(await (await getTestDb()).select().from(productLikes)).toHaveLength(0);
  });
  it('404 for unknown or unpublished products', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ name: 'Draft', category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'DRAFT', sellerId: s.id }, admin);
    expect((await like('nope')).status).toBe(404);
    expect((await like(draft.id)).status).toBe(404);
  });
  it('rate limits one actor to 30 likes/unlikes per minute (429), others unaffected', async () => {
    const h = { ...JSON_H, cookie: `rr_vid=${VID}` };
    for (let i = 0; i < 30; i++) expect((await like(i % 2 ? 'p1' : 'p2', h)).status).toBe(200);
    const blocked = await like('p1', h);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('Too many requests.');
    expect((await like('p1', { ...JSON_H, cookie: 'rr_vid=0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' })).status).toBe(200);
  });
});

describe('like rate limit without a cookie', () => {
  it('a client that never keeps the cookie still hits a per-IP limit (429), so it cannot mint unlimited visitors', async () => {
    const ip = { ...JSON_H, 'x-forwarded-for': '5.5.5.5' };
    let last = 200;
    for (let i = 0; i < 130; i++) last = (await like(i % 2 ? 'p1' : 'p2', ip)).status;
    expect(last).toBe(429);
    expect((await (await getTestDb()).select().from(productLikes)).length).toBeLessThanOrEqual(120);
    expect((await like('p1', { ...JSON_H, 'x-forwarded-for': '6.6.6.6' })).status).toBe(200);   // other networks unaffected
  });
});

describe('GET /api/likes', () => {
  it('returns counts for the requested published products and which ones this visitor liked; never cached', async () => {
    const r = await like('p1');
    const vid = /rr_vid=([^;]+)/.exec(r.headers.get('set-cookie')!)![1];
    await like('p1', { ...JSON_H, cookie: 'rr_vid=0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' });
    const res = await likesGet(new Request('http://x/api/likes?ids=p1,p2,bogus,p1', { headers: { cookie: `rr_vid=${vid}` } }));
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ counts: { p1: 2, p2: 0 }, liked: ['p1'] });
  });
  it('without a cookie nothing is "liked"; with no ids it is empty; absurd ids are capped', async () => {
    expect(await (await likesGet(new Request('http://x/api/likes?ids=p1'))).json()).toEqual({ counts: { p1: 0 }, liked: [] });
    expect(await (await likesGet(new Request('http://x/api/likes'))).json()).toEqual({ counts: {}, liked: [] });
    const many = Array.from({ length: 500 }, (_, i) => `p${i}`).join(',');
    expect(Object.keys((await (await likesGet(new Request(`http://x/api/likes?ids=${many}`))).json()).counts).length).toBeLessThanOrEqual(60);
  });
});

describe('POST /api/events', () => {
  it('records a view with a daily hashed viewer (no ip or user agent stored) and answers 204; the same viewer twice is one row', async () => {
    expect((await event({ type: 'view', productId: 'p1' })).status).toBe(204);
    expect((await event({ type: 'view', productId: 'p1' })).status).toBe(204);
    const rows = await (await getTestDb()).select().from(productEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: 'p1', type: 'view' });
    expect(rows[0].actor).toMatch(/^h:[0-9a-f]{32}$/);
    expect(JSON.stringify(rows)).not.toContain('1.2.3.4');
  });
  it('different visitors (ip or user agent) are different people', async () => {
    await event({ type: 'view', productId: 'p1' });
    await event({ type: 'view', productId: 'p1' }, { ...JSON_H, 'user-agent': BROWSER, 'x-forwarded-for': '9.9.9.9' });
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(2);
  });
  it('bots get 204 but nothing is written', async () => {
    expect((await event({ type: 'view', productId: 'p1' }, { ...JSON_H, 'user-agent': 'Googlebot/2.1' })).status).toBe(204);
    expect((await event({ type: 'view', productId: 'p1' }, { ...JSON_H })).status).toBe(204);       // no user agent
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(0);
  });
  it('validates the body: unknown type, bad product id, wrong shapes → 400; non-JSON → 415; invalid JSON → 400', async () => {
    for (const body of [{ type: 'purchase', productId: 'p1' }, { type: 'view', productId: 'x1' }, { type: 'view' }, { productId: 'p1' }, null, [], 'view', { type: 'view', productId: ['p1'] }])
      expect((await event(body)).status).toBe(400);
    expect((await eventsPost(new Request('http://x', { method: 'POST', body: 'type=view', headers: { 'content-type': 'text/plain', 'user-agent': BROWSER } }))).status).toBe(415);
    expect((await eventsPost(new Request('http://x', { method: 'POST', body: '{nope', headers: { ...JSON_H, 'user-agent': BROWSER } }))).status).toBe(400);
  });
  it('events for unpublished or unknown products are accepted with 204 but ignored (no information leak)', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ name: 'Draft', category: 'Pottery', city: 'Jaipur', pricePaise: 1, description: 'D', stock: 1, status: 'DRAFT', sellerId: s.id }, admin);
    expect((await event({ type: 'view', productId: draft.id })).status).toBe(204);
    expect((await event({ type: 'view', productId: 'p999' })).status).toBe(204);
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(0);
  });
  it('rate limits one ip to 120 events per minute (429)', async () => {
    let last = 204;
    for (let i = 0; i < 125; i++) last = (await event({ type: i % 3 === 0 ? 'view' : i % 3 === 1 ? 'contact' : 'artist', productId: 'p1' }, { ...JSON_H, 'user-agent': BROWSER + i, 'x-forwarded-for': '7.7.7.7' })).status;
    expect(last).toBe(429);
  });
});
