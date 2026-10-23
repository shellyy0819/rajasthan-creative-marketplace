import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors';

/** A city chosen from place search. Structurally compatible with upsertCity's parameter (no import, to avoid a cycle). */
export type CityPick = { osmType: string; osmId: number; name: string; state?: string; lat: number; lng: number };

const TTL_MS = 24 * 60 * 60 * 1000;
const INVALID = () => new ApiError(400, 'Invalid city selection.');

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not set; cannot sign city references.');
  return s;
}
const mac = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

/** "payload.signature": payload is base64url JSON of the pick plus an expiry; signature is HMAC-SHA256. */
export function signCityRef(p: CityPick, now: number = Date.now()): string {
  const { osmType, osmId, name, state, lat, lng } = p;
  const payload = Buffer.from(JSON.stringify({ osmType, osmId, name, ...(state ? { state } : {}), lat, lng, exp: now + TTL_MS })).toString('base64url');
  return `${payload}.${mac(payload)}`;
}

export function verifyCityRef(ref: unknown, now: number = Date.now()): CityPick {
  const key = secret();
  if (typeof ref !== 'string') throw INVALID();
  const parts = ref.split('.');
  if (parts.length !== 2) throw INVALID();
  const [payload, sig] = parts;
  const expected = Buffer.from(createHmac('sha256', key).update(payload).digest('base64url'));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw INVALID();
  let d: Record<string, unknown>;
  try { d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw INVALID(); }
  if (!d || typeof d !== 'object' || typeof d.exp !== 'number' || now > d.exp) throw INVALID();
  const { osmType, osmId, name, state, lat, lng } = d;
  if (typeof osmType !== 'string' || typeof osmId !== 'number' || typeof name !== 'string' || typeof lat !== 'number' || typeof lng !== 'number'
    || (state !== undefined && typeof state !== 'string')) throw INVALID();
  return { osmType, osmId, name, ...(state ? { state } : {}), lat, lng };
}
