import { lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairEvents } from '../db/schema';
import { ApiError } from './errors';
import { CODE_TAKEN, claimCode, parseClaim } from './fair-codes';
import { bad, obj } from './validate';

/** What a player did at the fair, as the admin "Fair players" page counts it. */
export const FAIR_EVENT_KINDS = ['stall', 'shortlist', 'activity', 'quest'] as const;
export type FairEventKind = (typeof FAIR_EVENT_KINDS)[number];
export type FairEventInput = { kind: FairEventKind; detail: string };
export const MAX_EVENTS_PER_CALL = 10;
export const DETAIL_MAX = 80;
/** How long events and play days are kept. */
export const EVENT_KEEP_DAYS = 90;

export function parseEvents(input: unknown): { code: string; token: string; events: FairEventInput[] } {
  const b = obj(input), claim = parseClaim(b);
  if (!Array.isArray(b.events) || b.events.length < 1 || b.events.length > MAX_EVENTS_PER_CALL) throw bad(`events must list 1 to ${MAX_EVENTS_PER_CALL} events.`);
  const events = b.events.map((e): FairEventInput => {
    const o = obj(e);
    if (typeof o.kind !== 'string' || !(FAIR_EVENT_KINDS as readonly string[]).includes(o.kind)) throw bad(`kind must be one of: ${FAIR_EVENT_KINDS.join(', ')}.`);
    const detail = typeof o.detail === 'string' ? o.detail.trim() : '';
    if (!detail || detail.length > DETAIL_MAX) throw bad(`detail must be 1 to ${DETAIL_MAX} characters.`);
    return { kind: o.kind as FairEventKind, detail };
  });
  return { ...claim, events };
}

/** Saves a player's events. Only the owner of the code can add to it. Events older than 90 days are deleted on the way. */
export async function recordEvents(e: ReturnType<typeof parseEvents>, now = new Date()): Promise<{ saved: number }> {
  if (await claimCode({ code: e.code, token: e.token }, now) === 'taken') throw new ApiError(409, CODE_TAKEN);
  const db = getDb();
  await db.insert(fairEvents).values(e.events.map(x => ({ code: e.code, kind: x.kind, detail: x.detail, at: now })));
  await db.delete(fairEvents).where(lt(fairEvents.at, new Date(now.getTime() - EVENT_KEEP_DAYS * 86_400_000)));
  return { saved: e.events.length };
}
