import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
import { GET, POST } from '@/app/api/categories/route';
import { POST as postProduct } from '@/app/api/products/route';
import { resetTestDb } from './helpers/testdb';

const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
const post = (body: unknown) => POST(new Request('http://x/api/categories', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); await resetTestDb(); });

describe('/api/categories', () => {
  it('GET is public and lists names', async () => {
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(['Crochet & Textiles', 'Accessories', 'Resin Art', 'Pottery']);
  });
  it('POST: 401 anonymous, 403 customers; sellers and admins can create (201), repeats are 200 with the stored name', async () => {
    expect((await post({ name: 'Toys' })).status).toBe(401);
    as('customer');
    expect((await post({ name: 'Toys' })).status).toBe(403);
    as('seller');
    const created = await post({ name: 'Wooden Toys' });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ name: 'Wooden Toys' });
    as('admin');
    const again = await post({ name: 'wooden  toys' });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ name: 'Wooden Toys' });
    expect(await (await GET()).json()).toContain('Wooden Toys');
  });
  it('POST validation errors are 400 with a message; non-JSON is 415; deactivated staff is 403', async () => {
    as('seller');
    const bad = await post({ name: '<b>x</b>' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/name/);
    expect((await POST(new Request('http://x', { method: 'POST', body: 'name=Toys', headers: { 'content-type': 'text/plain' } }))).status).toBe(415);
    authMock.mockResolvedValue({ user: { email: 's@x.co', role: 'seller', active: false } });
    expect((await post({ name: 'Toys' })).status).toBe(403);
  });
  it('end to end: create a category over the API, then create a product in it', async () => {
    as('admin');
    await post({ name: 'Brass Ware' });
    const res = await postProduct(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Brass Lamp', category: 'Brass Ware', city: 'Jaipur', pricePaise: 100, description: 'D', stock: 1 }), headers: { 'content-type': 'application/json' } }));
    expect(res.status).toBe(201);
    expect((await res.json()).category).toBe('Brass Ware');
  });
});
