import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createProduct, updateProduct, deleteProduct } from '@/lib/admin';
import { getProductForAdmin, listArtists, listProductsForAdmin, scopeFor } from '@/lib/admin-posts';
import { getProductBySlug, listProducts } from '@/lib/catalog';
import { products } from '@/db/schema';
import { admin } from './helpers/actors';
import { getTestDb, giveRole, makeSeller, resetTestDb, snapshot } from './helpers/testdb';

const base = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, description: 'Hand-set.', stock: 3 };
let A: Awaited<ReturnType<typeof makeSeller>>;
let B: Awaited<ReturnType<typeof makeSeller>>;
beforeEach(async () => {
  await resetTestDb();
  A = await makeSeller('alpha@x.co', 'Alpha Artist');
  B = await makeSeller('beta@x.co', 'Beta Artist');
});
const mine = (a = A) => scopeFor({ email: a.actor.email, role: 'seller' });
const adminOwned = async (sellerId: string, extra = {}) => createProduct({ ...base, sellerId, ...extra }, admin); // admin creates a published product for a seller

describe('seller create', () => {
  it('defaults to DRAFT, owned by the seller, unpublished fields empty; may create an ARCHIVED one', async () => {
    const p = await createProduct(base, A.actor);
    expect(p).toMatchObject({ status: 'DRAFT', sellerId: A.id, sellerEmail: 'alpha@x.co', seller: 'Alpha Artist' });
    expect(p).not.toHaveProperty('publishedAt');
    expect((await createProduct({ ...base, status: 'ARCHIVED' }, A.actor)).status).toBe('ARCHIVED');
  });
  it('can never create a published product (403), and status variants are 400', async () => {
    await expect(createProduct({ ...base, status: 'APPROVED' }, A.actor)).rejects.toMatchObject({ status: 403, message: 'Only an admin can publish a product.' });
    for (const status of ['approved', ' APPROVED', 'APPROVED ', 'Published']) await expect(createProduct({ ...base, status }, A.actor)).rejects.toMatchObject({ status: 400 });
    expect((await listProducts()).map(p => p.name)).not.toContain('Lac Bangle');
  });
  it('cannot assign another seller; assigning self is fine; unknown keys are ignored', async () => {
    await expect(createProduct({ ...base, sellerId: B.id }, A.actor)).rejects.toMatchObject({ status: 403, message: 'Only an admin can assign a seller.' });
    expect((await createProduct({ ...base, sellerId: A.id }, A.actor)).sellerId).toBe(A.id);
    const p = await createProduct({ ...base, role: 'admin', publishedBy: B.id, publishedAt: '2020-01-01' }, A.actor);
    expect(p).not.toHaveProperty('publishedBy');
  });
  it('workshop link must exist; pickup location is stored', async () => {
    await expect(createProduct({ ...base, workshopId: 'w99' }, A.actor)).rejects.toMatchObject({ status: 400 });
    expect(await createProduct({ ...base, workshopId: 'w1', pickupLocation: 'Shelf 3' }, A.actor)).toMatchObject({ workshopId: 'w1', pickupLocation: 'Shelf 3' });
  });
});

describe('admin create and assign', () => {
  it('admin defaults: APPROVED, seller = themselves, publishedBy/At recorded', async () => {
    const p = await createProduct(base, admin);
    expect(p).toMatchObject({ status: 'APPROVED', sellerEmail: 'root@x.co' });
    expect(p.publishedBy).toBeTruthy();
    expect(new Date(p.publishedAt!).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
  it('admin can create for a seller; the seller must exist, be active and hold a role', async () => {
    expect((await adminOwned(A.id)).sellerId).toBe(A.id);
    const buyer = await giveRole('buyer@x.co', 'customer');
    await expect(adminOwned(buyer.id)).rejects.toMatchObject({ status: 400, message: 'sellerId must be an active user with the seller role.' });
    await expect(adminOwned('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ status: 400 });
    await expect(createProduct({ ...base, sellerId: 'not-a-uuid' }, admin)).rejects.toMatchObject({ status: 400 });
    const { users } = await import('@/db/schema');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, B.id));
    await expect(adminOwned(B.id)).rejects.toMatchObject({ status: 400 });
  });
  it('a DRAFT created by admin has no publish stamp until it is published', async () => {
    const d = await createProduct({ ...base, status: 'DRAFT' }, admin);
    expect(d).not.toHaveProperty('publishedAt');
    const pub = await updateProduct(d.id, { status: 'APPROVED' }, admin);
    expect(pub.publishedBy).toBeTruthy();
  });
});

describe('seller edit / archive / publish rules', () => {
  it('edits own DRAFT keeping it DRAFT; archives and restores to DRAFT; cannot publish', async () => {
    const p = await createProduct(base, A.actor);
    expect(await updateProduct(p.id, { name: 'New name' }, A.actor)).toMatchObject({ name: 'New name', status: 'DRAFT' });
    expect((await updateProduct(p.id, { status: 'ARCHIVED' }, A.actor)).status).toBe('ARCHIVED');
    expect((await updateProduct(p.id, { status: 'DRAFT' }, A.actor)).status).toBe('DRAFT');
    await expect(updateProduct(p.id, { status: 'APPROVED' }, A.actor)).rejects.toMatchObject({ status: 403 });
    await updateProduct(p.id, { status: 'ARCHIVED' }, A.actor);
    await expect(updateProduct(p.id, { status: 'APPROVED' }, A.actor)).rejects.toMatchObject({ status: 403 });
    expect((await snapshot()).products.find(x => x.id === p.id)!.status).toBe('ARCHIVED');
  });
  it('editing a published product sends it back to DRAFT (even if the seller sends status APPROVED)', async () => {
    const p = await adminOwned(A.id);
    expect((await updateProduct(p.id, { stock: 9 }, A.actor)).status).toBe('DRAFT');
    await updateProduct(p.id, { status: 'APPROVED' }, admin);
    expect((await updateProduct(p.id, { description: 'changed', status: 'APPROVED' }, A.actor)).status).toBe('DRAFT');
    expect((await listProducts()).map(x => x.id)).not.toContain(p.id);
  });
  it('a no-op save keeps a published product published; archiving a published one is allowed; workshop/pickup/image changes count as edits', async () => {
    const p = await adminOwned(A.id);
    expect((await updateProduct(p.id, {}, A.actor)).status).toBe('APPROVED');
    expect((await updateProduct(p.id, { status: 'APPROVED', stock: 3 }, A.actor)).status).toBe('APPROVED'); // same value
    expect((await updateProduct(p.id, { pickupLocation: 'Moved' }, A.actor)).status).toBe('DRAFT');
    await updateProduct(p.id, { status: 'APPROVED' }, admin);
    expect((await updateProduct(p.id, { workshopId: 'w2' }, A.actor)).status).toBe('DRAFT');
    await updateProduct(p.id, { status: 'APPROVED' }, admin);
    expect((await updateProduct(p.id, { status: 'ARCHIVED' }, A.actor)).status).toBe('ARCHIVED');
  });
  it('admin publishes (stamping who/when) and may reassign the seller; seller cannot reassign', async () => {
    const p = await createProduct(base, A.actor);
    const pub = await updateProduct(p.id, { status: 'APPROVED' }, admin);
    expect(pub.status).toBe('APPROVED');
    expect(pub.publishedBy).toBeTruthy();
    expect((await updateProduct(p.id, { sellerId: B.id }, admin)).sellerId).toBe(B.id);
    await expect(updateProduct(p.id, { stock: 1 }, A.actor)).rejects.toMatchObject({ status: 404 });
    const q = await createProduct(base, A.actor);
    await expect(updateProduct(q.id, { sellerId: B.id }, A.actor)).rejects.toMatchObject({ status: 403 });
  });
  it('failed validation leaves the row unchanged', async () => {
    const p = await createProduct(base, A.actor);
    await expect(updateProduct(p.id, { stock: -1 }, A.actor)).rejects.toMatchObject({ status: 400 });
    expect((await snapshot()).products.find(x => x.id === p.id)!.stock).toBe(3);
  });
});

describe('cross-seller isolation (Review Focus 1)', () => {
  it("seller B gets 404 on seller A's product for read/edit/archive and sees none of it in lists or counts", async () => {
    const a = await createProduct(base, A.actor);
    await createProduct({ ...base, name: 'Beta Thing' }, B.actor);
    for (const fn of [() => getProductForAdmin(a.id, mine(B)), () => updateProduct(a.id, { stock: 1 }, B.actor), () => updateProduct(a.id, { status: 'ARCHIVED' }, B.actor)])
      await expect(fn()).rejects.toMatchObject({ status: 404, message: 'Product not found.' });
    expect((await listProductsForAdmin({}, mine(B))).map(p => p.seller)).toEqual(['Beta Artist']);
    expect((await listArtists(mine(B))).map(x => x.name)).toEqual(['Beta Artist']);
    expect((await listProductsForAdmin({}, mine(A))).map(p => p.seller)).toEqual(['Alpha Artist']);
    expect((await snapshot()).products.find(x => x.id === a.id)!.status).toBe('DRAFT');
  });
  it('seller matching ignores email case; seeded sellers own the seeded products; admin-owned products are invisible to sellers', async () => {
    const s = await makeSeller('Mixed.Case@X.co', 'Mixed');
    const p = await createProduct(base, { email: 'MIXED.CASE@x.co', role: 'seller' });
    expect((await getProductForAdmin(p.id, scopeFor({ email: 'mixed.case@X.CO', role: 'seller' }))).id).toBe(p.id);
    expect((await listProductsForAdmin({}, mine(A))).map(x => x.id)).not.toContain('p1');
    const own = await createProduct(base, admin);
    await expect(getProductForAdmin(own.id, mine(A))).rejects.toMatchObject({ status: 404 });
    expect(scopeFor({ email: 'a@x.co', role: 'admin' })).toEqual({});
    void s;
  });
});

describe('leakage (Review Focus 4)', () => {
  it('seller email, id, pickup location and publish info never appear in the public catalog', async () => {
    const p = await adminOwned(A.id, { pickupLocation: 'Secret shelf' });
    const pub = JSON.stringify(await listProducts()) + JSON.stringify(await getProductBySlug(`lac-bangle-${p.id}`));
    for (const secret of ['alpha@x.co', A.id, 'Secret shelf', 'publishedBy', 'sellerId', 'pickupLocation']) expect(pub).not.toContain(secret);
  });
});

describe('delete', () => {
  it('service delete works (the route restricts it to admins)', async () => {
    const p = await createProduct(base, A.actor);
    await deleteProduct(p.id);
    expect((await (await getTestDb()).select().from(products).where(eq(products.id, p.id)))).toHaveLength(0);
    await expect(deleteProduct(p.id)).rejects.toMatchObject({ status: 404 });
  });
});
