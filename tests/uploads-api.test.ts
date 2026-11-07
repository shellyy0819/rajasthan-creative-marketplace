import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const presign = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/s3-presigned-post', () => ({ createPresignedPost: presign }));
import { POST } from '@/app/api/uploads/product-image/route';
import { POST as LOGO } from '@/app/api/uploads/seller-logo/route';
import { resetLimitersForTests } from '@/lib/engagement-limits';
import { makeSeller, resetTestDb } from './helpers/testdb';

const ENV = { S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'AKIAFAKE', AWS_SECRET_ACCESS_KEY: 'secret' };
const J = { 'content-type': 'application/json' };
let saved: Record<string, string | undefined>;
const post = (body: unknown, headers: Record<string, string> = J) =>
  POST(new Request('http://x/api/uploads/product-image', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const as = (email: string | null, role = 'seller', extra: Record<string, unknown> = {}) => authMock.mockResolvedValue(email ? { user: { email, role, ...extra } } : null);

beforeEach(async () => {
  saved = Object.fromEntries(Object.keys(ENV).map(k => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  authMock.mockReset(); presign.mockReset();
  presign.mockImplementation(async (_c: unknown, opts: { Key: string; Fields: Record<string, string> }) => ({ url: 'https://b.s3.ap-south-1.amazonaws.com/', fields: { key: opts.Key, ...opts.Fields } }));
  resetLimitersForTests();
  await resetTestDb();
});
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

describe('POST /api/uploads/product-image', () => {
  it('gives a signed seller a one-file upload form for their own folder, never cached, without leaking the key field name or secrets', async () => {
    const s = await makeSeller('s@x.co', 'S'); as('s@x.co');
    const r = await post({ contentType: 'image/png', size: 1000 });
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const body = await r.json();
    expect(Object.keys(body).sort()).toEqual(['fields', 'publicUrl', 'url']);
    expect(body.fields.key).toMatch(new RegExp(`^products/${s.id}/[0-9a-f-]{36}\\.png$`));
    expect(body.publicUrl).toBe(`https://b.s3.ap-south-1.amazonaws.com/${body.fields.key}`);
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(presign.mock.calls[0][1]).toMatchObject({ Bucket: 'b', Expires: 300 });
  });
  it('an admin gets one too, in their own folder', async () => {
    as('root@x.co', 'admin');
    expect((await post({ contentType: 'image/webp', size: 5242880 })).status).toBe(200);
  });
  it('anonymous is 401, customers 403, a deactivated seller 403, and nothing is signed', async () => {
    as(null); expect((await post({ contentType: 'image/png', size: 10 })).status).toBe(401);
    as('buyer@x.co', 'customer'); expect((await post({ contentType: 'image/png', size: 10 })).status).toBe(403);
    as('off@x.co', 'seller', { active: false }); expect((await post({ contentType: 'image/png', size: 10 })).status).toBe(403);
    expect(presign).not.toHaveBeenCalled();
  });
  it('needs a JSON body and a valid type and size (400 with a reason), and never signs otherwise', async () => {
    await makeSeller('s@x.co', 'S'); as('s@x.co');
    expect((await post('contentType=image/png', { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await post('{nope')).status).toBe(400);
    for (const b of [{}, null, [], { contentType: 'image/svg+xml', size: 10 }, { contentType: 'image/gif', size: 10 }, { contentType: 'image/png', size: 0 }, { contentType: 'image/png', size: -5 },
      { contentType: 'image/png', size: 5242881 }, { contentType: 'image/png', size: 1.5 }, { contentType: 'image/png', size: '10' }, { contentType: 5, size: 10 }]) {
      const r = await post(b as never);
      expect(r.status, JSON.stringify(b)).toBe(400);
      expect(typeof (await r.json()).error).toBe('string');
    }
    expect(presign).not.toHaveBeenCalled();
  });
  it('answers 503 "Image uploads are not set up yet." when storage is not configured', async () => {
    await makeSeller('s@x.co', 'S'); as('s@x.co');
    for (const k of Object.keys(ENV)) delete process.env[k];
    const r = await post({ contentType: 'image/png', size: 10 });
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('Image uploads are not set up yet.');
  });
  it('limits one user to 60 permissions an hour (429); another user is unaffected', async () => {
    await makeSeller('s@x.co', 'S'); await makeSeller('t@x.co', 'T'); as('s@x.co');
    for (let i = 0; i < 60; i++) expect((await post({ contentType: 'image/png', size: 10 })).status).toBe(200);
    const blocked = await post({ contentType: 'image/png', size: 10 });
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('Too many requests.');
    as('t@x.co'); expect((await post({ contentType: 'image/png', size: 10 })).status).toBe(200);
  });
});

describe('POST /api/uploads/product-image stays staff-only', () => {
  it('a signed-in customer is still 403', async () => {
    as('buyer@x.co', 'customer');
    expect((await post({ contentType: 'image/png', size: 10 })).status).toBe(403);
    expect(presign).not.toHaveBeenCalled();
  });
});

describe('POST /api/uploads/seller-logo', () => {
  const logo = (body: unknown, headers: Record<string, string> = J) =>
    LOGO(new Request('http://x/api/uploads/seller-logo', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  it('requires sign-in (401), and a deactivated account is 403', async () => {
    as(null); expect((await logo({ contentType: 'image/png', size: 10 })).status).toBe(401);
    as('off@x.co', 'customer', { active: false }); expect((await logo({ contentType: 'image/png', size: 10 })).status).toBe(403);
    expect(presign).not.toHaveBeenCalled();
  });
  it('gives a signed-in customer a presigned form for jpg and png', async () => {
    as('new@x.co', 'customer');
    for (const contentType of ['image/png', 'image/jpeg']) {
      const r = await logo({ contentType, size: 1000 });
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(Object.keys(await r.json()).sort()).toEqual(['fields', 'publicUrl', 'url']);
    }
  });
  it('rejects webp and over 5 MiB', async () => {
    as('new@x.co', 'customer');
    expect((await logo({ contentType: 'image/webp', size: 1000 })).status).toBe(400);
    expect((await logo({ contentType: 'image/png', size: 5242881 })).status).toBe(400);
    expect(presign).not.toHaveBeenCalled();
  });
  it('503 without storage config', async () => {
    as('new@x.co', 'customer');
    for (const k of Object.keys(ENV)) delete process.env[k];
    const r = await logo({ contentType: 'image/png', size: 10 });
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe('Image uploads are not set up yet.');
  });
  it('429 after the per-email limit', async () => {
    as('new@x.co', 'customer');
    let last = 200;
    for (let i = 0; i < 100 && last !== 429; i++) last = (await logo({ contentType: 'image/png', size: 10 })).status;
    expect(last).toBe(429);
  });
});
