import { and, count, desc, gt, lt, ne, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairVisitors } from '../db/schema';
import type { Emote, Facing, FairVisitor } from './fair-types';
import { CODE_RE, EMOTES, FACINGS, FAIR_WORLD, LOOK_IDS, isLookId, type LookId } from './fair-constants';
import { CODE_TAKEN, TOKEN_RE, claimCode } from './fair-codes';
import { ApiError } from './errors';
import { bad, obj } from './validate';

export { CODE_ALPHABET, CODE_RE, EMOTES, FACINGS, FAIR_WORLD } from './fair-constants';

/** A visitor counts as "here now" if their last heartbeat is newer than this; rows older than KEEP_MS are deleted. */
export const ACTIVE_MS = 10_000;
export const KEEP_MS = 60_000;
export const MAX_VISIBLE = 30;

export type Heartbeat = { code: string; token: string; x: number; y: number; facing: Facing; look?: LookId; emote?: Emote };

const num = (v: unknown, field: string, max: number) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw bad(`${field} must be a number.`);
  return Math.round(Math.min(max, Math.max(0, v)) * 10) / 10;
};

export function parseHeartbeat(input: unknown): Heartbeat {
  const b = obj(input);
  if (typeof b.code !== 'string' || !CODE_RE.test(b.code)) throw bad('code must be 6 letters or numbers.');
  if (typeof b.token !== 'string' || !TOKEN_RE.test(b.token)) throw bad('token is missing or malformed.');
  if (typeof b.facing !== 'string' || !(FACINGS as readonly string[]).includes(b.facing)) throw bad(`facing must be one of: ${FACINGS.join(', ')}.`);
  if (b.emote !== undefined && b.emote !== null && (typeof b.emote !== 'string' || !(EMOTES as readonly string[]).includes(b.emote))) throw bad(`emote must be one of: ${EMOTES.join(', ')}.`);
  if (b.look !== undefined && b.look !== null && !isLookId(b.look)) throw bad(`look must be one of: ${LOOK_IDS.join(', ')}.`);
  const emote = b.emote ? (b.emote as Emote) : undefined, look = b.look ? (b.look as LookId) : undefined;
  return { code: b.code, token: b.token, x: num(b.x, 'x', FAIR_WORLD.w), y: num(b.y, 'y', FAIR_WORLD.h), facing: b.facing as Facing, ...(look ? { look } : {}), ...(emote ? { emote } : {}) };
}

/**
 * Records that `hb.code` is at this spot right now and returns everyone else who is here, plus how many people are here in total (including them).
 * An emote bumps the visitor's emote counter so other screens show it once.
 * The code must belong to this visitor: the first heartbeat claims a free code, and a code owned by someone else is refused with 409.
 */
export async function heartbeat(hb: Heartbeat, now = new Date()): Promise<{ visitors: FairVisitor[]; count: number }> {
  if (await claimCode({ code: hb.code, token: hb.token }, now) === 'taken') throw new ApiError(409, CODE_TAKEN);
  const db = getDb();
  const set = { x: hb.x, y: hb.y, facing: hb.facing, look: hb.look ?? null, seenAt: now, ...(hb.emote ? { emote: hb.emote, emoteSeq: sql`${fairVisitors.emoteSeq} + 1` } : {}) };
  await db.insert(fairVisitors).values({ code: hb.code, x: hb.x, y: hb.y, facing: hb.facing, look: hb.look ?? null, seenAt: now, ...(hb.emote ? { emote: hb.emote, emoteSeq: 1 } : {}) })
    .onConflictDoUpdate({ target: fairVisitors.code, set });
  await db.delete(fairVisitors).where(lt(fairVisitors.seenAt, new Date(now.getTime() - KEEP_MS)));
  const fresh = gt(fairVisitors.seenAt, new Date(now.getTime() - ACTIVE_MS));
  const [rows, [total]] = await Promise.all([
    db.select().from(fairVisitors).where(and(fresh, ne(fairVisitors.code, hb.code))).orderBy(desc(fairVisitors.seenAt)).limit(MAX_VISIBLE),
    db.select({ n: count() }).from(fairVisitors).where(fresh),
  ]);
  return {
    visitors: rows.map(r => ({ code: r.code, x: r.x, y: r.y, facing: r.facing as Facing, look: isLookId(r.look) ? r.look : null, emote: (r.emote as Emote | null) ?? null, emoteSeq: r.emoteSeq })),
    count: Number(total?.n ?? 1),
  };
}
