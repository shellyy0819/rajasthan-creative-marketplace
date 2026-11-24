import { lt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairPlayDays } from '../db/schema';
import { EVENT_KEEP_DAYS } from './fair-events';

/** A gap between two heartbeats longer than this is not play: the tab was idle or the device asleep. */
export const PLAY_GAP_MAX_MS = 15_000;
const IST_OFFSET_MS = 5.5 * 3_600_000;

/** The Indian calendar date (yyyy-mm-dd) of a moment: the day turns over at 18:30 UTC. */
export const istDay = (d: Date): string => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Seconds of play the heartbeat at `now` adds, given the player's previous one: the gap, rounded to a whole second, when it is under 15 seconds. */
export function playSecondsFor(prevSeenAt: Date | null, now: Date): number {
  if (!prevSeenAt) return 0;
  const gap = now.getTime() - prevSeenAt.getTime();
  return gap > 0 && gap < PLAY_GAP_MAX_MS ? Math.round(gap / 1000) : 0;
}

/** Adds this heartbeat's play time to the code's row for today (IST), and deletes play days older than 90 days. Holds no personal data. */
export async function addPlay(code: string, prevSeenAt: Date | null, now = new Date()): Promise<void> {
  const db = getDb(), seconds = playSecondsFor(prevSeenAt, now);
  await db.insert(fairPlayDays).values({ code, day: istDay(now), seconds, firstAt: now, lastAt: now })
    .onConflictDoUpdate({ target: [fairPlayDays.code, fairPlayDays.day], set: { seconds: sql`${fairPlayDays.seconds} + ${seconds}`, lastAt: now } });
  await db.delete(fairPlayDays).where(lt(fairPlayDays.day, istDay(new Date(now.getTime() - EVENT_KEEP_DAYS * 86_400_000))));
}
