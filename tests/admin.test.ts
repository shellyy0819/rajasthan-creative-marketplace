import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProduct, updateProduct, deleteProduct, createWorkshop, updateWorkshop, deleteWorkshop } from '@/lib/admin';
import { readDb } from '@/lib/db';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rradm-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});

const validProduct = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, seller: 'Marwar Lac', description: 'Hand-set lac bangle.', stock: 3 };
const validWorkshop = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, city: 'Jodhpur', venue: 'Studio 9', date: '2026-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.' };

describe('products admin', () => {
  it('creates with a fresh id, APPROVED status, persisted', async () => {
    const p = await createProduct(validProduct);
    expect(p.id).toBe('p5');
    expect(p.status).toBe('APPROVED');
    expect((await readDb()).products).toHaveLength(5);
  });
  it('ignores client-supplied id/status mass assignment on create', async () => {
    const p = await createProduct({ ...validProduct, id: 'p1', status: 'HACK' });
    expect(p.id).toBe('p5');
    expect(p.status).toBe('APPROVED');
  });
  it('rejects invalid fields with 400', async () => {
    for (const bad of [
      { ...validProduct, name: '' }, { ...validProduct, name: 'x'.repeat(201) },
      { ...validProduct, category: 'Nope' }, { ...validProduct, city: 'Mars' },
      { ...validProduct, pricePaise: -1 }, { ...validProduct, pricePaise: 1.5 }, { ...validProduct, pricePaise: '5' },
      { ...validProduct, stock: -1 }, { ...validProduct, stock: 1.2 }, null, 'str', [],
    ]) await expect(createProduct(bad)).rejects.toMatchObject({ status: 400 });
    expect((await readDb()).products).toHaveLength(4);
  });
  it('updates only allowed fields and keeps id', async () => {
    const p = await updateProduct('p1', { stock: 20, pricePaise: 90000, id: 'zzz' });
    expect(p).toMatchObject({ id: 'p1', stock: 20, pricePaise: 90000, name: 'Crochet Lily Bouquet' });
  });
  it('update validates and 404s', async () => {
    await expect(updateProduct('p1', { stock: -5 })).rejects.toMatchObject({ status: 400 });
    await expect(updateProduct('nope', { stock: 1 })).rejects.toMatchObject({ status: 404 });
    expect((await readDb()).products[0].stock).toBe(8);
  });
  it('deletes, 404 when missing', async () => {
    await deleteProduct('p2');
    expect((await readDb()).products.map(p => p.id)).toEqual(['p1', 'p3', 'p4']);
    await expect(deleteProduct('p2')).rejects.toMatchObject({ status: 404 });
  });
  it('concurrent creates get unique ids', async () => {
    const r = await Promise.all(Array.from({ length: 10 }, () => createProduct(validProduct)));
    expect(new Set(r.map(p => p.id)).size).toBe(10);
  });
});

describe('workshops admin', () => {
  it('creates with fresh id, booked 0, APPROVED', async () => {
    const w = await createWorkshop(validWorkshop);
    expect(w).toMatchObject({ id: 'w4', booked: 0, status: 'APPROVED' });
  });
  it('ignores client-supplied booked on create', async () => {
    expect((await createWorkshop({ ...validWorkshop, booked: 7 })).booked).toBe(0);
  });
  it('FREE forces price 0; PAID needs price > 0', async () => {
    expect((await createWorkshop({ ...validWorkshop, type: 'FREE', pricePaise: 500 })).pricePaise).toBe(0);
    await expect(createWorkshop({ ...validWorkshop, type: 'PAID', pricePaise: 0 })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects bad date/time/seats/type/city', async () => {
    for (const bad of [
      { ...validWorkshop, date: '2026-13-40' }, { ...validWorkshop, date: '01/12/2026' },
      { ...validWorkshop, time: '25:00' }, { ...validWorkshop, time: '4pm' },
      { ...validWorkshop, seats: 0 }, { ...validWorkshop, seats: 1001 }, { ...validWorkshop, seats: 2.5 },
      { ...validWorkshop, type: 'MAYBE' }, { ...validWorkshop, city: 'Mars' }, { ...validWorkshop, title: '' },
    ]) await expect(createWorkshop(bad)).rejects.toMatchObject({ status: 400 });
  });
  it('seats cannot drop below booked; booked not editable', async () => {
    await expect(updateWorkshop('w1', { seats: 2 })).rejects.toMatchObject({ status: 400 }); // booked 3
    const w = await updateWorkshop('w1', { seats: 3, booked: 0 });
    expect(w).toMatchObject({ seats: 3, booked: 3 });
  });
  it('update 404 / delete', async () => {
    await expect(updateWorkshop('nope', { seats: 5 })).rejects.toMatchObject({ status: 404 });
    await deleteWorkshop('w3');
    expect((await readDb()).workshops.map(w => w.id)).toEqual(['w1', 'w2']);
    await expect(deleteWorkshop('w3')).rejects.toMatchObject({ status: 404 });
  });
  it('switching an existing workshop to FREE zeroes its price', async () => {
    expect(await updateWorkshop('w1', { type: 'FREE' })).toMatchObject({ type: 'FREE', pricePaise: 0 });
  });
});
