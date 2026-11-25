import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { getTestDb } from './helpers/testdb';
import { trendDigests } from '@/db/schema';

const row = (over: Partial<typeof trendDigests.$inferInsert> = {}) => ({ createdBy: 'admin-1', model: 'test-model', status: 'ok', ...over });

beforeAll(async () => { await getTestDb(); }, 30_000);
afterEach(async () => { await (await getTestDb()).delete(trendDigests); });

describe('trend_digests table', () => {
  it('defaults items to an empty list and leaves it unpublished', async () => {
    const db = await getTestDb();
    const [r] = await db.insert(trendDigests).values(row()).returning();
    expect(r.items).toEqual([]);
    expect(r.publishedAt).toBeNull();
    expect(r.error).toBeNull();
  });
  it('rejects a status outside ok, empty and failed', async () => {
    const db = await getTestDb();
    await expect(db.insert(trendDigests).values(row({ status: 'bogus' }))).rejects.toThrow();
    for (const status of ['ok', 'empty', 'failed']) await db.insert(trendDigests).values(row({ status }));
  });
  it('allows only one published row', async () => {
    const db = await getTestDb();
    await db.insert(trendDigests).values(row({ publishedAt: new Date(), publishedBy: 'admin-1' }));
    await expect(db.insert(trendDigests).values(row({ publishedAt: new Date(), publishedBy: 'admin-2' }))).rejects.toThrow();
  });
  it('allows many unpublished rows', async () => {
    const db = await getTestDb();
    await db.insert(trendDigests).values(row());
    await db.insert(trendDigests).values(row());
    expect((await db.select().from(trendDigests)).length).toBe(2);
  });
});
