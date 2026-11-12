import { and, desc, eq, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairQuestDays } from '../db/schema';
import { ApiError } from './errors';
import { CODE_TAKEN, claimCode, parseClaim } from './fair-codes';
import { QUEST_IDS } from './fair-constants';
import { bad, obj } from './validate';

export type QuestSnap = { id: string; title: string; target: number };
export type QuestDay = { day: string; quests: QuestSnap[]; progress: Record<string, string[]>; updatedAt: string };
/** How many days of history a code keeps. */
export const KEEP_DAYS = 60;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function parseQuestSave(input: unknown) {
  const b = obj(input), claim = parseClaim(b);
  if (typeof b.day !== 'string' || !DAY_RE.test(b.day)) throw bad('day must look like 2026-11-12.');
  if (!Array.isArray(b.quests) || b.quests.length < 1 || b.quests.length > 5) throw bad('quests must list 1 to 5 quests.');
  const quests: QuestSnap[] = b.quests.map(q => {
    const o = obj(q);
    if (typeof o.id !== 'string' || !(QUEST_IDS as readonly string[]).includes(o.id)) throw bad('Unknown quest.');
    if (typeof o.title !== 'string' || !o.title.trim() || o.title.length > 80) throw bad('Quest title must be 1 to 80 characters.');
    if (typeof o.target !== 'number' || !Number.isInteger(o.target) || o.target < 1 || o.target > 5) throw bad('Quest target must be 1 to 5.');
    return { id: o.id, title: o.title.trim(), target: o.target };
  });
  const rawProgress = obj(b.progress ?? {}), progress: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(rawProgress)) {
    if (!(QUEST_IDS as readonly string[]).includes(k)) throw bad('Unknown quest in progress.');
    if (!Array.isArray(v) || v.length > 12 || v.some(x => typeof x !== 'string' || !x || x.length > 60)) throw bad('Progress must be a short list of short strings.');
    progress[k] = v as string[];
  }
  return { ...claim, day: b.day, quests, progress };
}
export type QuestSave = ReturnType<typeof parseQuestSave>;

const dayOf = (d: Date) => d.toISOString().slice(0, 10);
/** Saves one day of quests for a code the caller owns. */
export async function saveQuestDay(q: QuestSave, now = new Date()): Promise<void> {
  if (await claimCode({ code: q.code, token: q.token }, now) === 'taken') throw new ApiError(409, CODE_TAKEN);
  const db = getDb(), value = { quests: q.quests, progress: q.progress, updatedAt: now };
  await db.insert(fairQuestDays).values({ code: q.code, day: q.day, ...value }).onConflictDoUpdate({ target: [fairQuestDays.code, fairQuestDays.day], set: value });
  await db.delete(fairQuestDays).where(and(eq(fairQuestDays.code, q.code), lt(fairQuestDays.day, dayOf(new Date(now.getTime() - KEEP_DAYS * 86_400_000)))));
}
/** A code's quest days, newest first. Only the owner of the code can ask. */
export async function listQuestDays(c: { code: string; token: string }, now = new Date()): Promise<QuestDay[]> {
  if (await claimCode(c, now) === 'taken') throw new ApiError(409, CODE_TAKEN);
  const rows = await getDb().select().from(fairQuestDays).where(eq(fairQuestDays.code, c.code)).orderBy(desc(fairQuestDays.day)).limit(KEEP_DAYS);
  return rows.map(r => ({ day: r.day, quests: r.quests as QuestSnap[], progress: r.progress as Record<string, string[]>, updatedAt: r.updatedAt.toISOString() }));
}
export { parseClaim };
