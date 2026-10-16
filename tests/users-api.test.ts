import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET as listUsersRoute, POST as postUser } from '@/app/api/admin/users/route';
import { PATCH as patchUser, DELETE as deleteUserRoute } from '@/app/api/admin/users/[id]/route';
import { PUT as putUserProfile } from '@/app/api/admin/users/[id]/profile/route';
import { GET as getProfile, PUT as putProfile } from '@/app/api/profile/route';
import { POST as postProduct } from '@/app/api/products/route';
import { PATCH as patchProduct, DELETE as deleteProductRoute } from '@/app/api/products/[id]/route';
import { POST as postWorkshop } from '@/app/api/workshops/route';
import { PATCH as patchWorkshop, DELETE as deleteWorkshopRoute } from '@/app/api/workshops/[id]/route';
import { GET as summaryRoute } from '@/app/api/admin/summary/route';
import { GET as adminProducts } from '@/app/api/admin/products/route';
import { GET as adminProduct } from '@/app/api/admin/products/[id]/route';
import { GET as adminArtists } from '@/app/api/admin/artists/route';
import { GET as publicProducts } from '@/app/api/products/route';
import { POST as postOrder } from '@/app/api/orders/route';
import { createProduct } from '@/lib/admin';
import { admin } from './helpers/actors';
import { giveRole, makeSeller, resetTestDb, snapshot } from './helpers/testdb';

const as = (email: string | null, role: string, extra: Record<string, unknown> = {}) =>
  authMock.mockResolvedValue(email ? { user: { email, role, ...extra } } : null);
const asAdmin = () => as('root@x.co', 'admin');
const asSeller = (email = 'alpha@x.co') => as(email, 'seller');
const asCustomer = () => as('buyer@x.co', 'customer');
const req = (method: string, body?: unknown) => new Request('http://x/api/x', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const product = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, description: 'Hand-set.', stock: 3 };
const workshop = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, city: 'Jodhpur', venue: 'Studio 9', date: '2026-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn.' };
let A: Awaited<ReturnType<typeof makeSeller>>;
let rootId: string;

beforeEach(async () => {
  authMock.mockReset(); authMock.mockResolvedValue(null);
  process.env.ADMIN_EMAILS = '';
  await resetTestDb();
  rootId = (await giveRole('root@x.co', 'admin')).id;
  A = await makeSeller('alpha@x.co', 'Alpha Artist');
});

describe('/api/admin/users (admin only)', () => {
  const calls = () => [() => listUsersRoute(), () => postUser(req('POST', { email: 'n@x.co' })), () => patchUser(req('PATCH', { active: false }), idCtx(A.id)), () => deleteUserRoute(req('DELETE'), idCtx(A.id)), () => putUserProfile(req('PUT', { displayName: 'X' }), idCtx(A.id))];
  it('401 anonymous; 403 customer and seller — nothing changes', async () => {
    for (const c of calls()) expect((await c()).status).toBe(401);
    for (const who of [asCustomer, () => asSeller()]) { who(); for (const c of calls()) expect((await c()).status).toBe(403); }
    expect((await (await (async () => { asAdmin(); return listUsersRoute(); })()).json()).map((u: { email: string }) => u.email)).not.toContain('n@x.co');
  });
  it('403 for a deactivated admin session', async () => {
    as('root@x.co', 'admin', { active: false });
    for (const c of calls()) expect((await c()).status).toBe(403);
  });
  it('admin lists users with roles and counts (no-store), creates (201), duplicates 409, bad input 400, 415 for non-JSON', async () => {
    asAdmin();
    const list = await listUsersRoute();
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect((await list.json()).find((u: { email: string }) => u.email === 'alpha@x.co')).toMatchObject({ roles: ['seller'], products: 0 });
    const created = await postUser(req('POST', { email: 'New@X.co', name: 'New', roles: ['seller'] }));
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ email: 'new@x.co', roles: ['seller'] });
    expect((await postUser(req('POST', { email: 'new@x.co' }))).status).toBe(409);
    expect((await postUser(req('POST', { email: 'bad' }))).status).toBe(400);
    expect((await postUser(req('POST', { email: 'ok@x.co', roles: ['root'] }))).status).toBe(400);
    expect((await postUser(new Request('http://x', { method: 'POST', body: 'email=a', headers: { 'content-type': 'text/plain' } }))).status).toBe(415);
  });
  it('PATCH changes roles/active; DELETE blocked when the user owns data (409), allowed otherwise; bad ids are 404', async () => {
    asAdmin();
    expect((await (await patchUser(req('PATCH', { roles: ['seller', 'admin'] }), idCtx(A.id))).json()).roles).toEqual(['admin', 'seller']);
    expect((await (await patchUser(req('PATCH', { active: false }), idCtx(A.id))).json()).active).toBe(false);
    expect((await patchUser(req('PATCH', { roles: ['x'] }), idCtx(A.id))).status).toBe(400);
    expect((await patchUser(req('PATCH', {}), idCtx('not-a-uuid'))).status).toBe(404);
    expect((await patchUser(req('PATCH', {}), idCtx('00000000-0000-0000-0000-000000000000'))).status).toBe(404);
    expect((await patchUser(req('PATCH', { active: false }), idCtx(rootId))).status).toBe(409);
    await createProduct(product, A.actor);
    const blocked = await deleteUserRoute(req('DELETE'), idCtx(A.id));
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error).toContain('Deactivate');
    const fresh = await (await postUser(req('POST', { email: 'gone@x.co' }))).json();
    expect((await deleteUserRoute(req('DELETE'), idCtx(fresh.id))).status).toBe(200);
    expect((await deleteUserRoute(req('DELETE'), idCtx(rootId))).status).toBe(409);
    expect((await deleteUserRoute(req('DELETE'), idCtx('zzz'))).status).toBe(404);
  });
  it('a deactivated seller loses staff access on the next request', async () => {
    asAdmin();
    await patchUser(req('PATCH', { active: false }), idCtx(A.id));
    as('alpha@x.co', 'seller', { active: false });
    expect((await postProduct(req('POST', product))).status).toBe(403);
  });
});

describe('profile routes', () => {
  it('seller reads and saves their own profile; customers and anonymous cannot; invalid input is 400', async () => {
    expect((await getProfile()).status).toBe(401);
    asCustomer();
    expect((await getProfile()).status).toBe(403);
    expect((await putProfile(req('PUT', { displayName: 'X' }))).status).toBe(403);
    asSeller();
    expect(await (await getProfile()).json()).toMatchObject({ userId: A.id, displayName: 'Alpha Artist' });
    const saved = await putProfile(req('PUT', { displayName: 'Alpha Studio', publicPhone: '99898 98999', instagram: 'alpha' }));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ displayName: 'Alpha Studio', publicPhone: '9989898999', instagram: 'alpha' });
    expect((await putProfile(req('PUT', { displayName: 'Alpha', publicPhone: '12345' }))).status).toBe(400);
    expect((await putProfile(req('PUT', {}))).status).toBe(400);
  });
  it('a seller can only ever write their own profile (no way to name another user); admin edits any seller by id', async () => {
    const B = await makeSeller('beta@x.co', 'Beta Artist');
    asSeller();
    await putProfile(req('PUT', { displayName: 'Mine', userId: B.id }));
    asAdmin();
    expect((await (await putUserProfile(req('PUT', { displayName: 'Set By Admin' }), idCtx(B.id))).json()).displayName).toBe('Set By Admin');
    const rows = (await snapshot()).products; void rows;
    const { getProfileByEmail } = await import('@/lib/users');
    expect((await getProfileByEmail('beta@x.co')).displayName).toBe('Set By Admin');
    expect((await getProfileByEmail('alpha@x.co')).displayName).toBe('Mine');
    expect((await putUserProfile(req('PUT', { displayName: 'X' }), idCtx('nope'))).status).toBe(404);
  });
});

describe('product routes by role', () => {
  it('customer 403 on product writes; anonymous 401', async () => {
    expect((await postProduct(req('POST', product))).status).toBe(401);
    asCustomer();
    expect((await postProduct(req('POST', product))).status).toBe(403);
    expect((await patchProduct(req('PATCH', { stock: 1 }), idCtx('p1'))).status).toBe(403);
    expect((await deleteProductRoute(req('DELETE'), idCtx('p1'))).status).toBe(403);
  });
  it('seller: create draft (201), publish denied (403), own edit ok, others 404, delete 403', async () => {
    asSeller();
    const made = await postProduct(req('POST', product));
    expect(made.status).toBe(201);
    const mine = await made.json();
    expect(mine).toMatchObject({ status: 'DRAFT', sellerEmail: 'alpha@x.co' });
    expect((await postProduct(req('POST', { ...product, status: 'APPROVED' }))).status).toBe(403);
    expect((await patchProduct(req('PATCH', { status: 'APPROVED' }), idCtx(mine.id))).status).toBe(403);
    expect((await patchProduct(req('PATCH', { stock: 9 }), idCtx(mine.id))).status).toBe(200);
    expect((await patchProduct(req('PATCH', { status: 'ARCHIVED' }), idCtx(mine.id))).status).toBe(200);
    expect((await patchProduct(req('PATCH', { stock: 9 }), idCtx('p1'))).status).toBe(404);
    expect((await deleteProductRoute(req('DELETE'), idCtx(mine.id))).status).toBe(403);
    asAdmin();
    expect((await deleteProductRoute(req('DELETE'), idCtx(mine.id))).status).toBe(200);
  });
  it('seller cannot use workshop or summary routes', async () => {
    asSeller();
    for (const r of [await postWorkshop(req('POST', workshop)), await patchWorkshop(req('PATCH', { seats: 9 }), idCtx('w1')), await deleteWorkshopRoute(req('DELETE'), idCtx('w1')), await summaryRoute()])
      expect(r.status).toBe(403);
  });
  it('seller read APIs are scoped to their own products; admin sees all with sellerEmail; public API never leaks it', async () => {
    const B = await makeSeller('beta@x.co', 'Beta Artist');
    await createProduct(product, A.actor);
    const theirs = await createProduct({ ...product, name: 'Beta Thing' }, B.actor);
    asSeller();
    const list = await (await adminProducts(new Request('http://x/api/admin/products'))).json();
    expect(list.map((p: { sellerEmail: string }) => p.sellerEmail)).toEqual(['alpha@x.co']);
    expect((await adminProduct(req('GET'), idCtx(theirs.id))).status).toBe(404);
    expect((await (await adminArtists()).json()).map((a: { name: string }) => a.name)).toEqual(['Alpha Artist']);
    asAdmin();
    const all = await (await adminProducts(new Request('http://x/api/admin/products'))).json();
    expect(all.length).toBeGreaterThan(5);
    expect(all.every((p: { sellerEmail: string }) => p.sellerEmail)).toBe(true);
    const pub = JSON.stringify(await (await publicProducts(new Request('http://x/api/products'))).json());
    expect(pub).not.toContain('sellerEmail');
    expect(pub).not.toContain('@');
    asCustomer();
    expect((await adminProducts(new Request('http://x/api/admin/products'))).status).toBe(403);
    expect((await adminArtists()).status).toBe(403);
  });
});

describe('workshop delete (admin only) reports unlinked products', () => {
  it('keeps the products and returns how many were unlinked; summary counts users', async () => {
    asAdmin();
    const p1 = await (await postProduct(req('POST', { ...product, workshopId: 'w1' }))).json();
    await postProduct(req('POST', { ...product, workshopId: 'w1', name: 'Second' }));
    const del = await deleteWorkshopRoute(req('DELETE'), idCtx('w1'));
    expect(await del.json()).toEqual({ ok: true, unlinkedProducts: 2 });
    const s = await snapshot();
    expect(s.products.find(p => p.id === p1.id)).toBeDefined();
    expect(s.products.find(p => p.id === p1.id)).not.toHaveProperty('workshopId');
    expect((await deleteWorkshopRoute(req('DELETE'), idCtx('w1'))).status).toBe(404);
    expect(await (await summaryRoute()).json()).toMatchObject({ users: expect.any(Number), workshops: 2 });
  });
});

describe('buyers keep read access and checkout', () => {
  it('a customer can read the catalog and place a demo order; the buyer user row is created on demand', async () => {
    asCustomer();
    expect((await publicProducts(new Request('http://x/api/products'))).status).toBe(200);
    const o = await postOrder(req('POST', { customerName: 'B', email: 'buyer@x.co', items: [{ productId: 'p1', quantity: 1 }] }));
    expect(o.status).toBe(201);
    expect((await o.json()).userEmail).toBe('buyer@x.co');
  });
});
