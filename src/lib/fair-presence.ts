import { and, count, desc, gt, lt, ne, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairVisitors } from '../db/schema';
import type { Emote, Facing, FairVisitor } from './fair-types';
import { bad, obj } from './validate';

/** Size of the fair floor in world units. The client draws the same floor; positions outside it are clamped. */
export const FAIR_WORLD = { w: 1050, h: 780 } as const;
/** Visitor codes: six characters, no O, I, L, 0 or 1 (they are easy to misread). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);
export const FACINGS: readonly Facing[] = ['up', 'down', 'left', 'right'];
export const EMOTES: readonly Emote[] = ['wave', 'namaste', 'hello'];
/** A visitor counts as "here now" if their last heartbeat is newer than this; rows older than KEEP_MS are deleted. */
export const ACTIVE_MS = 10_000;
export const KEEP_MS = 60_000;
export const MAX_VISIBLE = 30;

export type Heartbeat = { code: string; x: number; y: number; facing: Facing; emote?: Emote };

const num = (v: unknown, field: string, max: number) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw bad(`${field} must be a number.`);
  return Math.round(Math.min(max, Math.max(0, v)) * 10) / 10;
};

export function parseHeartbeat(input: unknown): Heartbeat {
  const b = obj(input);
  if (typeof b.code !== 'string' || !CODE_RE.test(b.code)) throw bad('code must be 6 letters or numbers.');
  if (typeof b.facing !== 'string' || !(FACINGS as readonly string[]).includes(b.facing)) throw bad(`facing must be one of: ${FACINGS.join(', ')}.`);
  if (b.emote !== undefined && b.emote !== null && (typeof b.emote !== 'string' || !(EMOTES as readonly string[]).includes(b.emote))) throw bad(`emote must be one of: ${EMOTES.join(', ')}.`);
  const emote = b.emote ? (b.emote as Emote) : undefined;
  return { code: b.code, x: num(b.x, 'x', FAIR_WORLD.w), y: num(b.y, 'y', FAIR_WORLD.h), facing: b.facing as Facing, ...(emote ? { emote } : {}) };
}

/**
 * Records that `hb.code` is at this spot right now and returns everyone else who is here, plus how many people are here in total (including them).
 * An emote bumps the visitor's emote counter so other screens show it once.
 */
export async function heartbeat(hb: Heartbeat, now = new Date()): Promise<{ visitors: FairVisitor[]; count: number }> {
  const db = getDb();
  const set = { x: hb.x, y: hb.y, facing: hb.facing, seenAt: now, ...(hb.emote ? { emote: hb.emote, emoteSeq: sql`${fairVisitors.emoteSeq} + 1` } : {}) };
  await db.insert(fairVisitors).values({ code: hb.code, x: hb.x, y: hb.y, facing: hb.facing, seenAt: now, ...(hb.emote ? { emote: hb.emote, emoteSeq: 1 } : {}) })
    .onConflictDoUpdate({ target: fairVisitors.code, set });
  await db.delete(fairVisitors).where(lt(fairVisitors.seenAt, new Date(now.getTime() - KEEP_MS)));
  const fresh = gt(fairVisitors.seenAt, new Date(now.getTime() - ACTIVE_MS));
  const [rows, [total]] = await Promise.all([
    db.select().from(fairVisitors).where(and(fresh, ne(fairVisitors.code, hb.code))).orderBy(desc(fairVisitors.seenAt)).limit(MAX_VISIBLE),
    db.select({ n: count() }).from(fairVisitors).where(fresh),
  ]);
  return {
    visitors: rows.map(r => ({ code: r.code, x: r.x, y: r.y, facing: r.facing as Facing, emote: (r.emote as Emote | null) ?? null, emoteSeq: r.emoteSeq })),
    count: Number(total?.n ?? 1),
  };
}
