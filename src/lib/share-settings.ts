import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import type { AppSession } from './authz';
import { bad, obj, oneOf } from './validate';

/** Who sees the Share button: only admins (while it is being tried out), or every visitor. */
export type ShareVisibility = 'admin' | 'everyone';
export type ShareSettings = { visibility: ShareVisibility };
export const SHARE_VISIBILITIES: readonly ShareVisibility[] = ['admin', 'everyone'];
/** Until an admin flips the switch on the Settings page, Share is for admins only. */
export const DEFAULT_SHARE_SETTINGS: ShareSettings = { visibility: 'admin' };

export async function getShareSettings(): Promise<ShareSettings> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'share'));
  const v = (row?.value as Partial<ShareSettings> | undefined)?.visibility;
  return { visibility: v === 'admin' || v === 'everyone' ? v : DEFAULT_SHARE_SETTINGS.visibility };
}

const TTL_MS = 15_000;
let cache: { at: number; visibility: ShareVisibility } | null = null;
export function clearShareCache(): void { cache = null; }

/**
 * The saved visibility, kept in memory for 15 seconds so a page view does not cost a database read for it. Saving the setting clears it.
 * If it cannot be read, Share stays admins only: a feature that is switched off must never appear because of a database hiccup.
 */
export async function shareVisibility(): Promise<ShareVisibility> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.visibility;
  try {
    const { visibility } = await getShareSettings();
    cache = { at: Date.now(), visibility };
    return visibility;
  } catch { return DEFAULT_SHARE_SETTINGS.visibility; }
}

/** Whether this viewer may see Share under the given setting. Only an active admin counts as an admin. */
export function canSeeShare(visibility: ShareVisibility, session: AppSession): boolean {
  if (visibility === 'everyone') return true;
  return session?.user?.role === 'admin' && session.user.active !== false;
}

export async function shareVisibleTo(session: AppSession): Promise<boolean> {
  return canSeeShare(await shareVisibility(), session);
}

export async function saveShareSettings(input: unknown, actorEmail: string): Promise<ShareSettings> {
  const raw = obj(input);
  if (raw.visibility === undefined) throw bad('visibility is required.');
  const value: ShareSettings = { visibility: oneOf(raw.visibility, 'visibility', SHARE_VISIBILITIES) };
  await getDb().insert(appSettings).values({ key: 'share', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  clearShareCache();
  return value;
}
