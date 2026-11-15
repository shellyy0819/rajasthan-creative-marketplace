import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
import { GET as publicList } from '@/app/api/sourcing-types/route';
import { GET as adminList, POST } from '@/app/api/admin/sourcing-types/route';
import { PATCH, DELETE } from '@/app/api/admin/sourcing-types/[id]/route';
import { POST as postProduct } from '@/app/api/products/route';
import { resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
const req = (method: string, body?: unknown) => new Request('http://x/api/admin/sourcing-types', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); await resetTestDb(); });

describe('/api/sourcing-types (public)', () => {
  it('lists the active types in order, with no sign-in and no counts', async () => {
    const r = await publicList();
    expect(r.status).toBe(200);
    const list = await r.json();
    expect(list.map((t: { name: string }) => t.name)).toEqual(['Handmade', 'Curated', 'Resold']);
    expect(list[0]).not.toHaveProperty('productCount');
  });
});

describe('/api/admin/sourcing-types (admin only)', () => {
  it('401 anonymous, 403 customers and sellers, and nothing changes', async () => {
    expect((await adminList()).status).toBe(401);
    expect((await POST(req('POST', { name: 'Upcycled' }))).status).toBe(401);
    for (const role of ['customer', 'seller']) {
      as(role);
      expect((await adminList()).status).toBe(403);
      expect((await POST(req('POST', { name: 'Upcycled' }))).status).toBe(403);
      expect((await PATCH(req('PATCH', { active: false }), ctx('1'))).status).toBe(403);
      expect((await DELETE(req('DELETE'), ctx('2'))).status).toBe(403);
    }
    as('admin');
    expect((await (await adminList()).json()).map((t: { name: string }) => t.name)).toEqual(['Handmade', 'Curated', 'Resold']);
  });

  it('an admin adds, edits and deletes a type, and the product API accepts it', async () => {
    as('admin');
    const created = await POST(req('POST', { name: 'Upcycled', countsAsHandmade: true }));
    expect(created.status).toBe(201);
    const t = await created.json();
    expect(t).toMatchObject({ name: 'Upcycled', countsAsHandmade: true, productCount: 0 });
    expect((await POST(req('POST', { name: 'upcycled' }))).status).toBe(409);

    const patched = await PATCH(req('PATCH', { name: 'Upcycled goods', showBadge: false }), ctx(String(t.id)));
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ name: 'Upcycled goods', showBadge: false });
    expect((await PATCH(req('PATCH', {}), ctx(String(t.id)))).status).toBe(400);
    expect((await PATCH(req('PATCH', { active: false }), ctx('abc'))).status).toBe(404);

    const made = await postProduct(new Request('http://x', { method: 'POST', body: JSON.stringify({ name: 'Tin Lamp', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'D', stock: 1, sourcingTypeId: t.id }), headers: { 'content-type': 'application/json' } }));
    expect(made.status).toBe(201);
    expect((await made.json()).sourcing).toMatchObject({ id: t.id, name: 'Upcycled goods', countsAsHandmade: true, showBadge: false });

    expect((await DELETE(req('DELETE'), ctx(String(t.id)))).status).toBe(409); // a product uses it
    const other = await (await POST(req('POST', { name: 'Vintage' }))).json();
    expect((await DELETE(req('DELETE'), ctx(String(other.id)))).status).toBe(200);
  });
});
