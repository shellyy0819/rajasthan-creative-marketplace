import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import type { FairSource } from './fair-types';
import { bad, obj, oneOf } from './validate';

export type FairSettings = { source: FairSource };
export const FAIR_SOURCES: readonly FairSource[] = ['real', 'sample'];
/** Until an admin flips the switch the fair shows invented sample makers, never anyone's real shop by surprise. */
export const DEFAULT_FAIR_SETTINGS: FairSettings = { source: 'sample' };

export async function getFairSettings(): Promise<FairSettings> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'fair'));
  const v = row?.value as Partial<FairSettings> | undefined;
  return v && (v.source === 'real' || v.source === 'sample') ? { source: v.source } : DEFAULT_FAIR_SETTINGS;
}

export async function saveFairSettings(input: unknown, actorEmail: string): Promise<FairSettings> {
  const raw = obj(input);
  if (raw.source === undefined) throw bad('source is required.');
  const value: FairSettings = { source: oneOf(raw.source, 'source', FAIR_SOURCES) };
  await getDb().insert(appSettings).values({ key: 'fair', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return value;
}
