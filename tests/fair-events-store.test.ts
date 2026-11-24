import { beforeEach, describe, expect, it } from 'vitest';
import { fairEvents, fairPlayDays } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });

describe('the fair player tables', () => {
  it('has the two tables', async () => {
    const db = await getTestDb(), at = new Date('2026-11-12T10:00:00Z');
    await db.insert(fairEvents).values({ code: 'ABC234', kind: 'stall', detail: 'dhaga', at });
    await db.insert(fairPlayDays).values({ code: 'ABC234', day: '2026-11-12', seconds: 12, firstAt: at, lastAt: at });
    expect(await db.select().from(fairEvents)).toMatchObject([{ code: 'ABC234', kind: 'stall', detail: 'dhaga' }]);
    expect(await db.select().from(fairPlayDays)).toMatchObject([{ code: 'ABC234', day: '2026-11-12', seconds: 12 }]);
    await expect(db.insert(fairEvents).values({ code: 'ABC234', kind: 'fly', detail: 'x' })).rejects.toThrow();
  });
});
