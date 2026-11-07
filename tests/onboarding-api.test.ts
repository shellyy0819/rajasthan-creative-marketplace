import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
import { POST } from '@/app/api/onboarding/route';
import { resetLimitersForTests } from '@/lib/engagement-limits';
import { resolveRole } from '@/lib/roles';
import { cityRef } from './helpers/cities';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { getTestDb } from './helpers/testdb';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const J = { 'content-type': 'application/json' };
const ENV = ['S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'];
let saved: Record<string, string | undefined>;
const body = (over: Record<string, unknown> = {}) => ({
  fullName: 'Asha Verma', mobile: '9876543210', brandName: 'Asha Crafts', category: 'Pottery',
  description: 'Hand-thrown blue pottery.', cityRef: cityRef('Jaipur'), instagram: 'asha.crafts',
  logoUrl: 'https://example.com/logo.png', contactMethods: ['phone', 'instagram'], ...over,
});
const post = (b: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('http://x/api/onboarding', { method: 'POST', headers: { ...J, ...headers }, body: JSON.stringify(b) }));
const as = (email: string | null, extra: Record<string, unknown> = {}) => authMock.mockResolvedValue(email ? { user: { email, role: 'customer', ...extra } } : null);

beforeEach(async () => {
  saved = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  process.env.ADMIN_EMAILS = '';
  authMock.mockReset(); revalidate.mockReset(); resetLimitersForTests();
  await resetTestDb();
});
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

describe('POST /api/onboarding', () => {
  it('401 when signed out', async () => {
    as(null);
    expect((await post(body())).status).toBe(401);
  });
  it('403 when the session says the account is deactivated', async () => {
    as('off@x.co', { active: false });
    expect((await post(body())).status).toBe(403);
    expect(await resolveRole('off@x.co')).toBe('customer');
  });
  it('403 when the account is deactivated in the database, and no role is granted', async () => {
    const s = await makeSeller('off@x.co', 'Off');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, s.id));
    as('off@x.co');
    expect((await post(body())).status).toBe(403);
  });
  it('422 returns field-keyed errors', async () => {
    as('new@x.co');
    const r = await post(body({ mobile: '123', cityRef: undefined, cityId: undefined }));
    expect(r.status).toBe(422);
    const { errors } = await r.json();
    expect(errors.mobile).toBe('Enter a 10-digit mobile number.');
    expect(typeof errors.cityRef).toBe('string');
    expect(await resolveRole('new@x.co')).toBe('customer');
  });
  it('422 for a non-object body', async () => {
    as('new@x.co');
    expect((await post([])).status).toBe(422);
  });
  it('200 and role granted for new verified user', async () => {
    as('new@x.co');
    const r = await post(body());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'created' });
    expect(await resolveRole('new@x.co')).toBe('seller');
    expect(revalidate).toHaveBeenCalledWith('/', 'layout');
  });
  it('does not revalidate when it fails', async () => {
    as('new@x.co');
    await post(body({ mobile: '1' }));
    expect(revalidate).not.toHaveBeenCalled();
  });
  it('429 after limit (per email)', async () => {
    as('new@x.co');
    let last = 200;
    for (let i = 0; i < 40 && last !== 429; i++) last = (await post(body({ mobile: '1' }), { 'x-forwarded-for': `10.0.0.${i}` })).status;
    expect(last).toBe(429);
    as('other@x.co');
    expect((await post(body(), { 'x-forwarded-for': '10.9.9.9' })).status).toBe(200);
  });
  it('429 after limit (per IP, across emails)', async () => {
    let last = 200;
    for (let i = 0; i < 60 && last !== 429; i++) { as(`u${i}@x.co`); last = (await post(body({ mobile: '1' }), { 'x-forwarded-for': '5.5.5.5' })).status; }
    expect(last).toBe(429);
  });
  describe('with storage configured', () => {
    beforeEach(() => Object.assign(process.env, { S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's' }));
    it('422 on logoUrl when it is not under the storage public base', async () => {
      as('new@x.co');
      const r = await post(body({ logoUrl: 'https://evil.example/logo.png' }));
      expect(r.status).toBe(422);
      expect(typeof (await r.json()).errors.logoUrl).toBe('string');
      expect(await resolveRole('new@x.co')).toBe('customer');
    });
    it('rejects a lookalike host prefix', async () => {
      as('new@x.co');
      expect((await post(body({ logoUrl: 'https://b.s3.ap-south-1.amazonaws.com.evil.example/x.png' }))).status).toBe(422);
    });
    it('accepts a logo under the public base', async () => {
      as('new@x.co');
      expect((await post(body({ logoUrl: 'https://b.s3.ap-south-1.amazonaws.com/products/u/x.png' }))).status).toBe(200);
    });
  });
});
