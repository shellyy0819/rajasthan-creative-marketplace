import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { products } from '@/db/schema';
import { createProduct, updateProduct } from '@/lib/admin';
import { createSourcingType, defaultSourcingTypeId, deleteSourcingType, listSourcingTypes, listSourcingTypesForAdmin, resolveSourcingTypeId, updateSourcingType } from '@/lib/sourcing-types';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const names = async () => (await listSourcingTypes(undefined, { all: true })).map(t => t.name);
const base = { name: 'Lamp', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'D', stock: 1, status: 'DRAFT' };

describe('sourcing types', () => {
  it('starts with Handmade (counts as handmade, no badge), Curated and Resold, and every fixture product is Handmade', async () => {
    const all = await listSourcingTypesForAdmin();
    expect(all.map(t => [t.name, t.countsAsHandmade, t.showBadge, t.active])).toEqual([['Handmade', true, false, true], ['Curated', false, true, true], ['Resold', false, true, true]]);
    expect(all[0].productCount).toBeGreaterThan(0);
    expect(all[1].productCount).toBe(0);
  });

  it('admin can add a type; the name rule and uniqueness (ignoring case) apply', async () => {
    const t = await createSourcingType({ name: '  Upcycled  ', countsAsHandmade: true });
    expect(t).toMatchObject({ name: 'Upcycled', countsAsHandmade: true, showBadge: true, active: true, position: 4, productCount: 0 });
    await expect(createSourcingType({ name: 'upcycled' })).rejects.toMatchObject({ status: 409 });
    await expect(createSourcingType({ name: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(createSourcingType({ name: 'Fine', showBadge: 'yes' })).rejects.toMatchObject({ status: 400 });
  });

  it('rename, switches, and moving change the order the sellers see', async () => {
    const [h, c, r] = await listSourcingTypes();
    await updateSourcingType(c.id, { name: 'Curated by us', showBadge: false });
    expect((await listSourcingTypes()).find(t => t.id === c.id)).toMatchObject({ name: 'Curated by us', showBadge: false });
    await updateSourcingType(r.id, { move: 'up' });
    expect(await names()).toEqual(['Handmade', 'Resold', 'Curated by us']);
    await updateSourcingType(h.id, { move: 'up' }); // already first: nothing moves
    expect((await names())[0]).toBe('Handmade');
    await expect(updateSourcingType(c.id, {})).rejects.toMatchObject({ status: 400 });
    await expect(updateSourcingType(9999, { name: 'Nope' })).rejects.toMatchObject({ status: 404 });
  });

  it('a switched-off type leaves the public list, and the last active one cannot be switched off', async () => {
    const [h, c, r] = await listSourcingTypes();
    await updateSourcingType(c.id, { active: false });
    expect((await listSourcingTypes()).map(t => t.name)).toEqual(['Handmade', 'Resold']);
    await updateSourcingType(r.id, { active: false });
    await expect(updateSourcingType(h.id, { active: false })).rejects.toMatchObject({ status: 409 });
  });

  it('delete works for an unused type only, and never for the last active one', async () => {
    const [h, c, r] = await listSourcingTypes();
    await expect(deleteSourcingType(h.id)).rejects.toMatchObject({ status: 409 });   // products use it
    await deleteSourcingType(c.id);
    expect(await names()).toEqual(['Handmade', 'Resold']);
    await updateSourcingType(h.id, { active: false });
    await expect(deleteSourcingType(r.id)).rejects.toMatchObject({ status: 409 });   // the last active one
    await expect(deleteSourcingType(9999)).rejects.toMatchObject({ status: 404 });
  });

  it('a new product defaults to the first active type; a chosen type is stored; an off or unknown one is refused', async () => {
    const s = await makeSeller('lamp@x.co', 'Lamp Maker');
    const [h, c] = await listSourcingTypes();
    const dflt = await createProduct({ ...base, sellerId: s.id }, admin);
    expect(dflt.sourcing).toMatchObject({ id: h.id, name: 'Handmade', countsAsHandmade: true, showBadge: false });
    const curated = await createProduct({ ...base, name: 'Brass', sellerId: s.id, sourcingTypeId: c.id }, admin);
    expect(curated.sourcing).toMatchObject({ id: c.id, name: 'Curated', showBadge: true });
    await expect(createProduct({ ...base, sellerId: s.id, sourcingTypeId: 9999 }, admin)).rejects.toMatchObject({ status: 400 });
    await updateSourcingType(c.id, { active: false });
    await expect(createProduct({ ...base, sellerId: s.id, sourcingTypeId: c.id }, admin)).rejects.toMatchObject({ status: 400 });
    expect(await defaultSourcingTypeId(await getTestDb())).toBe(h.id);
  });

  it('an edit keeps the type unless one is sent; a product may keep a type that was switched off later', async () => {
    const s = await makeSeller('lamp2@x.co', 'Lamp Maker');
    const [, c, r] = await listSourcingTypes();
    const p = await createProduct({ ...base, sellerId: s.id, sourcingTypeId: c.id }, admin);
    expect((await updateProduct(p.id, { name: 'Renamed' }, admin)).sourcing!.id).toBe(c.id);
    await updateSourcingType(c.id, { active: false });
    expect((await updateProduct(p.id, { name: 'Renamed again', sourcingTypeId: c.id }, admin)).sourcing!.id).toBe(c.id);
    expect((await updateProduct(p.id, { sourcingTypeId: r.id }, admin)).sourcing!.name).toBe('Resold');
    await expect(updateProduct(p.id, { sourcingTypeId: c.id }, admin)).rejects.toMatchObject({ status: 400 }); // switching back to an off type
    const db = await getTestDb();
    expect((await db.select({ id: products.sourcingTypeId }).from(products).where(eq(products.id, p.id)))[0].id).toBe(r.id);
  });

  it('resolveSourcingTypeId: nothing chosen keeps the current id', async () => {
    const db = await getTestDb();
    const [, c] = await listSourcingTypes();
    expect(await resolveSourcingTypeId(db, undefined, c.id)).toBe(c.id);
    expect(await resolveSourcingTypeId(db, 0, c.id)).toBe(c.id);
  });

  it('a seller changing the type of a live product sends it back to review', async () => {
    const s = await makeSeller('lamp3@x.co', 'Lamp Maker');
    const [, c] = await listSourcingTypes();
    const live = await createProduct({ ...base, sellerId: s.id, status: 'APPROVED' }, admin);
    const mine = { email: 'lamp3@x.co', role: 'seller' as const };
    const after = await updateProduct(live.id, { sourcingTypeId: c.id }, mine);
    expect(after.status).toBe('DRAFT');
  });
});
