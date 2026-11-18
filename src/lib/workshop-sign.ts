import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { bad, obj } from './validate';

export { DEFAULT_SIGN, SIGN_MAX, boardLines, signFor, type SignText } from './workshop-sign-text';
import { SIGN_MAX as MAX, type SignText, DEFAULT_SIGN } from './workshop-sign-text';

const KEY = 'workshop-sign';

function field(raw: Record<string, unknown>, name: keyof SignText, label: string): string {
  const v = raw[name];
  if (typeof v !== 'string') throw bad(`${name} must be text.`);
  const t = v.replace(/\s+/g, ' ').trim();
  if (/\p{Cc}/u.test(v.replace(/\s/g, ' '))) throw bad(`${name} cannot have control characters.`);
  if (/[\r\n]/.test(v.trim())) throw bad(`${name} must be a single line.`);
  if (!t || t.length > MAX) throw bad(`${name} (${label}) must be 1 to ${MAX} characters.`);
  return t;
}

export function parseSign(input: unknown): SignText {
  const raw = obj(input);
  const out = { idle: field(raw, 'idle', 'no workshop live'), one: field(raw, 'one', 'one workshop live'), many: field(raw, 'many', 'several live') };
  if (!out.many.includes('{n}')) throw bad('many must contain {n}, the number of live workshops.');
  return out;
}

export async function getSignText(): Promise<SignText> {
  try {
    const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, KEY));
    return row ? parseSign(row.value) : DEFAULT_SIGN;
  } catch { return DEFAULT_SIGN; } // a missing database or an old bad value must never take the page down
}

export async function saveSignText(input: unknown, actorEmail: string): Promise<SignText> {
  const value = parseSign(input);
  await getDb().insert(appSettings).values({ key: KEY, value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return value;
}
