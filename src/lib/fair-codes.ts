import { createHash } from 'node:crypto';
import { and, eq, lt, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import { fairCodes } from '../db/schema';
import { CODE_RE } from './fair-constants';
import { bad, obj } from './validate';

/** A code nobody has used for this long is free again. */
export const CODE_TTL_MS = 30 * 24 * 3_600_000;
/** The secret a browser keeps to prove a code is its own: 32 to 64 lowercase hex characters. */
export const TOKEN_RE = /^[a-f0-9]{32,64}$/;
export const CODE_TAKEN = 'Code already taken.';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type Claim = { code: string; token: string };
export function parseClaim(input: unknown): Claim {
  const b = obj(input);
  if (typeof b.code !== 'string' || !CODE_RE.test(b.code)) throw bad('code must be 6 letters or numbers.');
  if (typeof b.token !== 'string' || !TOKEN_RE.test(b.token)) throw bad('token is missing or malformed.');
  return { code: b.code, token: b.token };
}

/**
 * Claims `code` for the holder of `token`. Returns 'ok' if it was free, expired or already theirs, and 'taken' if someone else owns it.
 * One statement, so two people choosing the same code at the same moment cannot both win.
 */
export async function claimCode(c: Claim, now = new Date()): Promise<'ok' | 'taken'> {
  const db = getDb(), hash = hashToken(c.token);
  const rows = await db.insert(fairCodes).values({ code: c.code, tokenHash: hash, claimedAt: now, seenAt: now })
    .onConflictDoUpdate({
      target: fairCodes.code, set: { tokenHash: hash, seenAt: now },
      setWhere: or(eq(fairCodes.tokenHash, hash), lt(fairCodes.seenAt, new Date(now.getTime() - CODE_TTL_MS))),
    }).returning({ code: fairCodes.code });
  if (!rows.length) return 'taken';
  await db.delete(fairCodes).where(and(lt(fairCodes.seenAt, new Date(now.getTime() - CODE_TTL_MS)), eq(fairCodes.tokenHash, hash)));
  return 'ok';
}
