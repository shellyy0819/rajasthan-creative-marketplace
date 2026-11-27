import { count, desc, max, min, sql, sum } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairEvents, fairPlayDays, fairQuestDays } from '../db/schema';
import type { QuestSnap } from './fair-quest-days';

/** One row of the admin "Fair players" page. A player is a random fair code, never a person. Dates are ISO strings. */
export type FairPlayer = {
  code: string; firstSeen: string; lastSeen: string; days: number; minutes: number;
  stalls: number; shortlisted: number; questsDone: number; questsTotal: number;
};

/**
 * Every code that has played (a play-day row) or done something (an event), most recently seen first.
 * Quests come from the code's latest saved quest day: how many of that day's quests are finished out of how many were offered.
 * `finishedAll` keeps only players who finished every quest of that day.
 */
export async function listPlayers(opts: { finishedAll?: boolean; limit?: number } = {}): Promise<FairPlayer[]> {
  const db = getDb(), limit = opts.limit ?? 200;
  const [plays, acts, quests] = await Promise.all([
    db.select({ code: fairPlayDays.code, days: count(), seconds: sum(fairPlayDays.seconds), first: min(fairPlayDays.firstAt), last: max(fairPlayDays.lastAt) }).from(fairPlayDays).groupBy(fairPlayDays.code),
    db.select({
      code: fairEvents.code, first: min(fairEvents.at), last: max(fairEvents.at),
      stalls: sql<number>`count(distinct ${fairEvents.detail}) filter (where ${fairEvents.kind} = 'stall')`,
      shortlisted: sql<number>`count(*) filter (where ${fairEvents.kind} = 'shortlist')`,
    }).from(fairEvents).groupBy(fairEvents.code),
    db.selectDistinctOn([fairQuestDays.code]).from(fairQuestDays).orderBy(fairQuestDays.code, desc(fairQuestDays.day)),
  ]);
  const play = new Map(plays.map(p => [p.code, p])), act = new Map(acts.map(a => [a.code, a])), quest = new Map(quests.map(q => [q.code, q]));
  const earliest = (...d: Array<Date | null | undefined>) => new Date(Math.min(...d.filter((x): x is Date => !!x).map(x => x.getTime())));
  const latest = (...d: Array<Date | null | undefined>) => new Date(Math.max(...d.filter((x): x is Date => !!x).map(x => x.getTime())));
  const rows = [...new Set([...play.keys(), ...act.keys()])].map((code): FairPlayer => {
    const p = play.get(code), a = act.get(code), q = quest.get(code);
    const snaps = (q?.quests ?? []) as QuestSnap[], progress = (q?.progress ?? {}) as Record<string, string[]>;
    return {
      code, firstSeen: earliest(p?.first, a?.first).toISOString(), lastSeen: latest(p?.last, a?.last).toISOString(),
      days: Number(p?.days ?? 0), minutes: Math.floor(Number(p?.seconds ?? 0) / 60),
      stalls: Number(a?.stalls ?? 0), shortlisted: Number(a?.shortlisted ?? 0),
      questsDone: snaps.filter(s => (progress[s.id]?.length ?? 0) >= s.target).length, questsTotal: snaps.length,
    };
  });
  return rows.filter(r => !opts.finishedAll || (r.questsTotal > 0 && r.questsDone === r.questsTotal)).sort((x, y) => y.lastSeen.localeCompare(x.lastSeen)).slice(0, limit);
}
