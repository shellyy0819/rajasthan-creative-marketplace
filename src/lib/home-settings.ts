import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { DEFAULT_HOME_SETTINGS, MAKERS_ROTATE_MAX_SECONDS, MAKERS_ROTATE_MIN_SECONDS, validRotateSeconds, type HomeSettings } from './home-settings-shared';
import { bad, obj } from './validate';

/** The saved home-page options. Anything missing or out of range falls back to the default, so a bad row can never break the home page. */
export async function getHomeSettings(): Promise<HomeSettings> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'home'));
  const v = row?.value as Partial<HomeSettings> | undefined;
  return { makersRotateSeconds: validRotateSeconds(v?.makersRotateSeconds) ? v.makersRotateSeconds : DEFAULT_HOME_SETTINGS.makersRotateSeconds };
}

/** Saves the options that were sent and keeps the others as they are; at least one must be sent. */
export async function saveHomeSettings(input: unknown, actorEmail: string): Promise<HomeSettings> {
  const raw = obj(input);
  if (raw.makersRotateSeconds === undefined) throw bad('makersRotateSeconds is required.');
  if (!validRotateSeconds(raw.makersRotateSeconds)) throw bad(`makersRotateSeconds must be a whole number of seconds from ${MAKERS_ROTATE_MIN_SECONDS} to ${MAKERS_ROTATE_MAX_SECONDS}.`);
  const current = await getHomeSettings();
  const value: HomeSettings = { ...current, makersRotateSeconds: raw.makersRotateSeconds };
  await getDb().insert(appSettings).values({ key: 'home', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return value;
}
