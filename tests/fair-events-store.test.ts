import { beforeEach, describe, expect, it } from 'vitest';
import { fairEvents, fairPlayDays } from '@/db/schema';
import { ApiError } from '@/lib/errors';
import { DETAIL_MAX, EVENT_KEEP_DAYS, MAX_EVENTS_PER_CALL, parseEvents, recordEvents } from '@/lib/fair-events';
import { getTestDb, resetTestDb } from './helpers/testdb';

const A = 'a'.repeat(32), B = 'b'.repeat(32), NOW = new Date('2026-11-12T10:00:00Z');
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const events = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'stall', detail: `maker-${i}` }));
const ev = (o: Record<string, unknown> = {}) => parseEvents({ code: 'ABC234', token: A, events: [{ kind: 'stall', detail: 'dhaga' }], ...o });
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

describe('parseEvents', () => {
  it('accepts one event and the most that is allowed in one call', () => {
    expect(ev().events).toEqual([{ kind: 'stall', detail: 'dhaga' }]);
    expect(ev({ events: events(MAX_EVENTS_PER_CALL) }).events).toHaveLength(MAX_EVENTS_PER_CALL);
  });
  it('rejects no events, too many, an unknown kind, a missing or empty detail and a detail that is too long', () => {
    expect(() => ev({ events: [] })).toThrow(/events/);
    expect(() => ev({ events: events(MAX_EVENTS_PER_CALL + 1) })).toThrow(/events/);
    expect(() => ev({ events: [{ kind: 'fly', detail: 'x' }] })).toThrow(/kind/);
    expect(() => ev({ events: [{ kind: 'stall', detail: 5 }] })).toThrow(/detail/);
    expect(() => ev({ events: [{ kind: 'stall', detail: '  ' }] })).toThrow(/detail/);
    expect(() => ev({ events: [{ kind: 'stall', detail: 'x'.repeat(DETAIL_MAX + 1) }] })).toThrow(/detail/);
    expect(() => ev({ events: 'stall' })).toThrow(/events/);
  });
  it('needs a valid code and token', () => {
    expect(() => ev({ code: 'no' })).toThrow();
    expect(() => ev({ token: 'short' })).toThrow();
  });
});

describe('recordEvents', () => {
  it('stores the events under the code at the time given', async () => {
    const r = await recordEvents(ev({ events: [{ kind: 'stall', detail: 'dhaga' }, { kind: 'quest', detail: 'meet3' }] }), NOW);
    expect(r).toEqual({ saved: 2 });
    const rows = await (await getTestDb()).select().from(fairEvents);
    expect(rows.map(r => [r.code, r.kind, r.detail, r.at.toISOString()])).toEqual([
      ['ABC234', 'stall', 'dhaga', NOW.toISOString()], ['ABC234', 'quest', 'meet3', NOW.toISOString()],
    ]);
  });
  it('refuses a code that belongs to someone else and stores nothing', async () => {
    await recordEvents(ev(), NOW);
    const err = await recordEvents(ev({ token: B }), NOW).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect(await (await getTestDb()).select().from(fairEvents)).toHaveLength(1);
  });
  it('deletes events older than 90 days and keeps newer ones', async () => {
    const db = await getTestDb();
    await db.insert(fairEvents).values([{ code: 'OLD234', kind: 'stall', detail: 'a', at: days(EVENT_KEEP_DAYS + 1) }, { code: 'NEW234', kind: 'stall', detail: 'b', at: days(EVENT_KEEP_DAYS - 1) }]);
    await recordEvents(ev(), NOW);
    expect((await db.select().from(fairEvents)).map(r => r.code).sort()).toEqual(['ABC234', 'NEW234']);
  });
});
