import { describe, it, expect, beforeEach, vi } from 'vitest';
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
import { GET, POST } from '@/app/api/listing-requests/route';
import { PATCH } from '@/app/api/listing-requests/[id]/route';
import { resolveAccess } from '@/lib/roles';
import { resetListingLimiterForTests } from '@/lib/engagement-limits';
import { listListingRequests } from '@/lib/listing-requests';
import { resetTestDb } from './helpers/testdb';

const J = { 'content-type': 'application/json' };
const body = { ownerName: 'Meera Sharma', phone: '9989898999', email: 'meera@pottery.in', businessName: 'Meera Pottery', size: 'medium' };
const post = (b: unknown, headers: Record<string, string> = { ...J, 'x-forwarded-for': '1.1.1.1' }) =>
  POST(new Request('http://x/api/listing-requests', { method: 'POST', headers, body: typeof b === 'string' ? b : JSON.stringify(b) }));

beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); resetListingLimiterForTests(); await resetTestDb(); });

describe('POST /api/listing-requests (public)', () => {
  it('accepts a valid request without sign-in: 201 and one stored row; the response echoes no stored data', async () => {
    const r = await post(body);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true });
    expect(await listListingRequests()).toHaveLength(1);
  });
  it('needs a JSON content type (415), valid JSON (400) and valid fields (400 with a message)', async () => {
    expect((await post('x=1', { 'content-type': 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ ...body, email: '' })).status).toBe(400);
    const r = await post({ ...body, phone: '123' });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/phone/);
    expect(await listListingRequests()).toHaveLength(0);
  });
  it('a filled honeypot field pretends success and stores nothing', async () => {
    const r = await post({ ...body, companyWebsite: 'http://spam.example' });
    expect(r.status).toBe(201);
    expect(await listListingRequests()).toHaveLength(0);
  });
  it('limits one address to 5 requests per hour (429); other addresses are unaffected', async () => {
    for (let i = 0; i < 5; i++) expect((await post({ ...body, businessName: `B${i}` })).status).toBe(201);
    const blocked = await post(body);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('Too many requests.');
    expect((await post(body, { ...J, 'x-forwarded-for': '2.2.2.2' })).status).toBe(201);
  });
});

describe('GET /api/listing-requests (admin only)', () => {
  it('401 anonymous, 403 for sellers and customers, 200 for admins with no-store', async () => {
    await post(body);
    expect((await GET()).status).toBe(401);
    for (const role of ['customer', 'seller']) { authMock.mockResolvedValue({ user: { email: 'x@x.co', role } }); expect((await GET()).status).toBe(403); }
    authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual([expect.objectContaining({ ownerName: 'Meera Sharma', phone: '+919989898999', email: 'meera@pottery.in', size: 'medium', status: 'received' })]);
  });
});

describe('PATCH /api/listing-requests/:id (admin confirms)', () => {
  const patch = (id: string, b: unknown, headers: Record<string, string> = J) =>
    PATCH(new Request(`http://x/api/listing-requests/${id}`, { method: 'PATCH', headers, body: typeof b === 'string' ? b : JSON.stringify(b) }), { params: Promise.resolve({ id }) });
  const create = async () => { await post(body); return (await listListingRequests())[0].id; };
  const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });

  it('401 anonymous, 403 sellers and customers, and nothing changes', async () => {
    const id = await create();
    expect((await patch(id, { status: 'confirmed' })).status).toBe(401);
    for (const role of ['customer', 'seller']) { authMock.mockResolvedValue({ user: { email: 'x@x.co', role } }); expect((await patch(id, { status: 'confirmed' })).status).toBe(403); }
    expect((await listListingRequests())[0].status).toBe('received');
    expect((await resolveAccess('meera@pottery.in')).role).toBe('customer');
  });
  it('an admin confirms: 200 with the confirmed request, and the owner can now sign in as a seller', async () => {
    const id = await create(); asAdmin();
    const r = await patch(id, { status: 'confirmed' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ id, status: 'confirmed', email: 'meera@pottery.in' });
    expect((await resolveAccess('meera@pottery.in')).role).toBe('seller');
  });
  it('only "confirmed" is accepted; junk bodies, ids and content types are rejected', async () => {
    const id = await create(); asAdmin();
    for (const b of [{ status: 'received' }, { status: 'rejected' }, { status: 5 }, {}, { role: 'admin' }, [], null]) expect((await patch(id, b)).status).toBe(400);
    expect((await patch(id, 'status=confirmed', { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await patch('not-a-uuid', { status: 'confirmed' })).status).toBe(404);
    expect((await patch('00000000-0000-4000-8000-000000000000', { status: 'confirmed' })).status).toBe(404);
    expect((await listListingRequests())[0].status).toBe('received');
  });
});
