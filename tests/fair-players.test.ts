import { beforeEach, describe, expect, it } from 'vitest';
import { fairEvents, fairPlayDays, fairQuestDays } from '@/db/schema';
import { listPlayers } from '@/lib/fair-players';
import { getTestDb, resetTestDb } from './helpers/testdb';

const at = (iso: string) => new Date(iso);
const play = (code: string, day: string, seconds: number, first: string, last: string) => ({ code, day, seconds, firstAt: at(first), lastAt: at(last) });
const ev = (code: string, kind: string, detail: string, when: string) => ({ code, kind, detail, at: at(when) });
const snap = (done: number) => ({ quests: [{ id: 'meet3', title: 'Meet 3', target: 3 }, { id: 'craft', title: 'Watch', target: 1 }, { id: 'selfie', title: 'Selfie', target: 1 }],
  progress: { meet3: ['a', 'b', 'c'].slice(0, done >= 1 ? 3 : 1), craft: done >= 2 ? ['dhaga'] : [], selfie: done >= 3 ? ['x'] : [] } });
beforeEach(async () => { await resetTestDb(); });

describe('listPlayers', () => {
  it('sums up one player: visits, days, minutes, stalls, shortlist and quests', async () => {
    const db = await getTestDb();
    await db.insert(fairPlayDays).values([
      play('FULL23', '2026-11-10', 600, '2026-11-10T04:00:00Z', '2026-11-10T04:10:00Z'),
      play('FULL23', '2026-11-11', 300, '2026-11-11T05:00:00Z', '2026-11-11T05:05:00Z'),
      play('FULL23', '2026-11-12', 59, '2026-11-12T06:00:00Z', '2026-11-12T06:01:00Z'),
    ]);
    await db.insert(fairEvents).values([
      ev('FULL23', 'stall', 'dhaga', '2026-11-12T06:00:10Z'), ev('FULL23', 'stall', 'dhaga', '2026-11-12T06:00:20Z'), ev('FULL23', 'stall', 'resin', '2026-11-12T06:00:30Z'),
      ev('FULL23', 'stall', 'kaath', '2026-11-12T06:00:40Z'), ev('FULL23', 'stall', 'noel', '2026-11-12T06:00:50Z'),
      ev('FULL23', 'shortlist', 'dhaga:0', '2026-11-12T06:00:15Z'), ev('FULL23', 'shortlist', 'resin:1', '2026-11-12T06:00:35Z'),
      ev('FULL23', 'activity', 'balloon', '2026-11-12T06:00:45Z'),
    ]);
    await db.insert(fairQuestDays).values([{ code: 'FULL23', day: '2026-11-11', ...snap(1) }, { code: 'FULL23', day: '2026-11-12', ...snap(2) }]);
    expect(await listPlayers()).toEqual([{
      code: 'FULL23', firstSeen: '2026-11-10T04:00:00.000Z', lastSeen: '2026-11-12T06:01:00.000Z', days: 3, minutes: 15, stalls: 4, shortlisted: 2, questsDone: 2, questsTotal: 3,
    }]);
  });

  it('shows a player who only has events, with no play time and no quests', async () => {
    await (await getTestDb()).insert(fairEvents).values([ev('EVT234', 'stall', 'dhaga', '2026-11-12T06:00:10Z'), ev('EVT234', 'quest', 'meet3', '2026-11-12T06:09:00Z')]);
    expect(await listPlayers()).toEqual([{
      code: 'EVT234', firstSeen: '2026-11-12T06:00:10.000Z', lastSeen: '2026-11-12T06:09:00.000Z', days: 0, minutes: 0, stalls: 1, shortlisted: 0, questsDone: 0, questsTotal: 0,
    }]);
  });

  it('shows a player who only has play time', async () => {
    await (await getTestDb()).insert(fairPlayDays).values(play('PLY234', '2026-11-12', 130, '2026-11-12T06:00:00Z', '2026-11-12T06:02:10Z'));
    expect(await listPlayers()).toMatchObject([{ code: 'PLY234', days: 1, minutes: 2, stalls: 0, shortlisted: 0 }]);
  });

  it('lists the most recent player first, and honours the limit', async () => {
    const db = await getTestDb();
    await db.insert(fairPlayDays).values([play('OLD234', '2026-11-01', 60, '2026-11-01T06:00:00Z', '2026-11-01T06:01:00Z'), play('NEW234', '2026-11-12', 60, '2026-11-12T06:00:00Z', '2026-11-12T06:01:00Z')]);
    expect((await listPlayers()).map(p => p.code)).toEqual(['NEW234', 'OLD234']);
    expect((await listPlayers({ limit: 1 })).map(p => p.code)).toEqual(['NEW234']);
  });

  it('can keep only the players who finished all of the latest day\'s quests', async () => {
    const db = await getTestDb();
    await db.insert(fairPlayDays).values([play('WON234', '2026-11-12', 60, '2026-11-12T06:00:00Z', '2026-11-12T06:01:00Z'), play('MID234', '2026-11-12', 60, '2026-11-12T07:00:00Z', '2026-11-12T07:01:00Z'), play('NON234', '2026-11-12', 60, '2026-11-12T08:00:00Z', '2026-11-12T08:01:00Z')]);
    await db.insert(fairQuestDays).values([{ code: 'WON234', day: '2026-11-12', ...snap(3) }, { code: 'MID234', day: '2026-11-12', ...snap(2) }]);
    expect((await listPlayers({ finishedAll: true })).map(p => p.code)).toEqual(['WON234']);
    expect((await listPlayers()).map(p => [p.code, p.questsDone, p.questsTotal])).toEqual([['NON234', 0, 0], ['MID234', 2, 3], ['WON234', 3, 3]]);
  });
});
