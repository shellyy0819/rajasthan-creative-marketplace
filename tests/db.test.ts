import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readDb, mutateDb } from '@/lib/db';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrdb-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});

describe('db', () => {
  it('reads seed data', async () => {
    const db = await readDb();
    expect(db.products.length).toBe(4);
  });

  it('serializes 25 concurrent mutations without losing writes', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        mutateDb(db => { db.orders.push({ id: String(i) } as never); }),
      ),
    );
    const db = await readDb();
    expect(db.orders).toHaveLength(25);
  });

  it('does not write when the mutation throws', async () => {
    await expect(mutateDb(db => { db.products[0].stock = 0; throw new Error('nope'); })).rejects.toThrow('nope');
    expect((await readDb()).products[0].stock).toBe(8);
  });

  it('keeps working after a failed mutation', async () => {
    await mutateDb(() => { throw new Error('x'); }).catch(() => {});
    await mutateDb(db => { db.bookings.push({ id: 'b' } as never); });
    expect((await readDb()).bookings).toHaveLength(1);
  });
});
