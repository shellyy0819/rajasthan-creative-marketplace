import { beforeEach, describe, expect, it } from 'vitest';
import { asc } from 'drizzle-orm';
import { fairPlayDays } from '@/db/schema';
import { EVENT_KEEP_DAYS } from '@/lib/fair-events';
import { addPlay, istDay, PLAY_GAP_MAX_MS, playSecondsFor } from '@/lib/fair-play';
import { heartbeat, parseHeartbeat } from '@/lib/fair-presence';
import { getTestDb, resetTestDb } from './helpers/testdb';

const TOKEN = 'a'.repeat(32), T0 = new Date('2026-11-12T10:00:00Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);
const beat = (code: string, now: Date) => heartbeat(parseHeartbeat({ code, token: TOKEN, x: 100, y: 300, facing: 'down' }), now);
const rows = async () => (await getTestDb()).select().from(fairPlayDays).orderBy(asc(fairPlayDays.day));
beforeEach(async () => { await resetTestDb(); });

describe('playSecondsFor', () => {
  it('counts the gap since the last heartbeat, rounded to whole seconds, when it is under 15 seconds', () => {
    expect(PLAY_GAP_MAX_MS).toBe(15_000);
    expect(playSecondsFor(null, T0)).toBe(0);
    expect(playSecondsFor(at(-2.5), T0)).toBe(3);
    expect(playSecondsFor(at(-14), T0)).toBe(14);
    expect(playSecondsFor(at(-0.2), T0)).toBe(0);
  });
  it('counts nothing for a gap of 15 seconds or more (an idle tab, a closed laptop) or a clock that went backwards', () => {
    expect(playSecondsFor(at(-15), T0)).toBe(0);
    expect(playSecondsFor(at(-16), T0)).toBe(0);
    expect(playSecondsFor(at(-3600), T0)).toBe(0);
    expect(playSecondsFor(at(5), T0)).toBe(0);
  });
});

describe('istDay', () => {
  it('is the Indian calendar date: the day turns over at 18:30 UTC', () => {
    expect(istDay(new Date('2026-11-12T18:29:59Z'))).toBe('2026-11-12');
    expect(istDay(new Date('2026-11-12T18:30:00Z'))).toBe('2026-11-13');
  });
});

describe('play time from the heartbeat', () => {
  it('adds the time between heartbeats to the code\'s row for the day, and sets first and last time', async () => {
    await beat('ABC234', at(0)); await beat('ABC234', at(2)); await beat('ABC234', at(5));
    expect(await rows()).toMatchObject([{ code: 'ABC234', day: '2026-11-12', seconds: 5, firstAt: at(0), lastAt: at(5) }]);
  });
  it('adds nothing after a long pause but moves the last time on', async () => {
    await beat('ABC234', at(0)); await beat('ABC234', at(2)); await beat('ABC234', at(62));
    expect(await rows()).toMatchObject([{ seconds: 2, lastAt: at(62) }]);
  });
  it('keeps each player separate', async () => {
    await beat('ABC234', at(0)); await beat('XYZ234', at(1)); await beat('ABC234', at(3));
    expect((await rows()).map(r => [r.code, r.seconds]).sort()).toEqual([['ABC234', 3], ['XYZ234', 0]]);
  });
  it('puts play either side of IST midnight on the right days', async () => {
    await beat('ABC234', new Date('2026-11-12T18:29:58Z')); await beat('ABC234', new Date('2026-11-12T18:30:01Z'));
    expect((await rows()).map(r => [r.day, r.seconds])).toEqual([['2026-11-12', 0], ['2026-11-13', 3]]);
  });
});

describe('retention', () => {
  it('deletes play days older than 90 days when someone plays, and keeps newer ones', async () => {
    const db = await getTestDb(), old = new Date(T0.getTime() - (EVENT_KEEP_DAYS + 2) * 86_400_000), fresh = new Date(T0.getTime() - (EVENT_KEEP_DAYS - 2) * 86_400_000);
    await db.insert(fairPlayDays).values([{ code: 'OLD234', day: istDay(old), seconds: 9, firstAt: old, lastAt: old }, { code: 'NEW234', day: istDay(fresh), seconds: 9, firstAt: fresh, lastAt: fresh }]);
    await addPlay('ABC234', null, T0);
    expect((await rows()).map(r => r.code).sort()).toEqual(['ABC234', 'NEW234']);
  });
});
