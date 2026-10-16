import { ApiError } from './errors';
import { normalizePhone, PHONE_HINT } from './phone';

export type Raw = Record<string, unknown>;
export const bad = (msg: string) => new ApiError(400, msg);
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function obj(input: unknown): Raw {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('Body must be a JSON object.');
  return input as Raw;
}
export function text(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw bad(`${field} must be a non-empty string up to ${max} characters.`);
  return v.trim();
}
export function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad(`${field} must be an integer between ${min} and ${max}.`);
  return v;
}
export function optionalText(v: unknown, field: string, max: number): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.trim().length > max) throw bad(`${field} must be text up to ${max} characters.`);
  return v.trim() || undefined;
}
export function optionalPhone(v: unknown, field = 'phone'): string | undefined {
  const t = optionalText(v, field, 40);
  if (t === undefined) return undefined;
  const n = normalizePhone(t);
  if (!n) throw bad(`${field} is invalid. ${PHONE_HINT}`);
  return n;
}
export function optionalEmail(v: unknown, field = 'email'): string | undefined {
  const t = optionalText(v, field, 200);
  if (t && !EMAIL_RE.test(t)) throw bad(`${field} must be a valid email address.`);
  return t;
}
export function optionalUuid(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw bad(`${field} must be a valid id.`);
  return v.toLowerCase();
}
export function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw bad(`${field} must be one of: ${allowed.join(', ')}.`);
  return v as T;
}
export function pick(input: Raw, keys: readonly string[]): Raw {
  return Object.fromEntries(keys.filter(k => k in input).map(k => [k, input[k]]));
}
export function optionalImageUrl(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const msg = 'imageUrl must be an https URL up to 500 characters.';
  if (typeof v !== 'string' || v.trim().length > 500) throw bad(msg);
  let u: URL;
  try { u = new URL(v.trim()); } catch { throw bad(msg); }
  if (u.protocol !== 'https:' || u.username || u.password) throw bad(msg);
  return u.toString();
}
export function validDate(d: unknown): string {
  const ok = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && (() => {
    const t = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
  })();
  if (!ok) throw bad('date must be a real date in YYYY-MM-DD format.');
  return d as string;
}
