import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { ApiError } from './errors';
import type { FairSource } from './fair-types';
import { bad, obj, oneOf } from './validate';

/** `enabled` is the master switch for the whole exhibition; `source` is which makers its stalls show. */
export type FairSettings = { enabled: boolean; source: FairSource };
export const FAIR_SOURCES: readonly FairSource[] = ['real', 'sample'];
/** Until an admin flips the switch the fair is open and shows invented sample makers, never anyone's real shop by surprise. */
export const DEFAULT_FAIR_SETTINGS: FairSettings = { enabled: true, source: 'sample' };

export async function getFairSettings(): Promise<FairSettings> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'fair'));
  const v = row?.value as Partial<FairSettings> | undefined;
  return {
    enabled: typeof v?.enabled === 'boolean' ? v.enabled : DEFAULT_FAIR_SETTINGS.enabled,
    source: v?.source === 'real' || v?.source === 'sample' ? v.source : DEFAULT_FAIR_SETTINGS.source,
  };
}

const OPEN_TTL_MS = 15_000;
let openCache: { at: number; open: boolean } | null = null;
export function clearFairOpenCache(): void { openCache = null; }

/**
 * Is the exhibition open? Every page asks (for the header link), so the answer is kept in memory for 15 seconds
 * instead of costing a database round trip before the first byte of each page. Saving the setting clears it.
 * If the settings cannot be read the fair stays open rather than vanishing.
 */
export async function isFairOpen(): Promise<boolean> {
  if (openCache && Date.now() - openCache.at < OPEN_TTL_MS) return openCache.open;
  try {
    const open = (await getFairSettings()).enabled;
    openCache = { at: Date.now(), open };
    return open;
  } catch { return true; }
}

/** For the fair's own API routes: a closed fair answers 404 and stores nothing. */
export async function requireFairOpen(): Promise<void> {
  if (!(await isFairOpen())) throw new ApiError(404, 'The fair is closed for now.');
}

/** Saves the fields that were sent and keeps the others as they are; at least one must be sent. */
export async function saveFairSettings(input: unknown, actorEmail: string): Promise<FairSettings> {
  const raw = obj(input);
  if (raw.source === undefined && raw.enabled === undefined) throw bad('source or enabled is required.');
  if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') throw bad('enabled must be true or false.');
  const current = await getFairSettings();
  const value: FairSettings = {
    enabled: raw.enabled === undefined ? current.enabled : (raw.enabled as boolean),
    source: raw.source === undefined ? current.source : oneOf(raw.source, 'source', FAIR_SOURCES),
  };
  await getDb().insert(appSettings).values({ key: 'fair', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  clearFairOpenCache();
  return value;
}
