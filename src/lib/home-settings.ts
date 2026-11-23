import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { DEFAULT_HOME_MIN_WORKSHOPS, DEFAULT_HOME_PRODUCT_LIMIT, MAX_HOME_MIN_WORKSHOPS, MAX_HOME_PRODUCT_LIMIT, MIN_HOME_MIN_WORKSHOPS, MIN_HOME_PRODUCT_LIMIT } from './catalog-shared';
import { bad, int, obj } from './validate';

/**
 * What an admin controls about the home page.
 * `productLimit`: how many products the "Finds" shelf shows (the rest is on /shop).
 * `minWorkshops`: the workshop section appears only while at least this many workshops are on; 0 shows it always.
 */
export type HomeSettings = { productLimit: number; minWorkshops: number };
export const DEFAULT_HOME_SETTINGS: HomeSettings = { productLimit: DEFAULT_HOME_PRODUCT_LIMIT, minWorkshops: DEFAULT_HOME_MIN_WORKSHOPS };

const inRange = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/** Never saved, or a stored value outside the bounds: the default for that field, so a bad row can neither empty the shelf, flood the page nor hide or show the workshops by accident. */
export async function getHomeSettings(): Promise<HomeSettings> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'home'));
  const v = row?.value as Partial<HomeSettings> | undefined;
  return {
    productLimit: inRange(v?.productLimit, MIN_HOME_PRODUCT_LIMIT, MAX_HOME_PRODUCT_LIMIT) ? v!.productLimit! : DEFAULT_HOME_SETTINGS.productLimit,
    minWorkshops: inRange(v?.minWorkshops, MIN_HOME_MIN_WORKSHOPS, MAX_HOME_MIN_WORKSHOPS) ? v!.minWorkshops! : DEFAULT_HOME_SETTINGS.minWorkshops,
  };
}

/** Saves the fields that were sent and keeps the other as it is; at least one must be sent. */
export async function saveHomeSettings(input: unknown, actorEmail: string): Promise<HomeSettings> {
  const raw = obj(input);
  if (raw.productLimit === undefined && raw.minWorkshops === undefined) throw bad('productLimit or minWorkshops is required.');
  const current = await getHomeSettings();
  const value: HomeSettings = {
    productLimit: raw.productLimit === undefined ? current.productLimit : int(raw.productLimit, 'productLimit', MIN_HOME_PRODUCT_LIMIT, MAX_HOME_PRODUCT_LIMIT),
    minWorkshops: raw.minWorkshops === undefined ? current.minWorkshops : int(raw.minWorkshops, 'minWorkshops', MIN_HOME_MIN_WORKSHOPS, MAX_HOME_MIN_WORKSHOPS),
  };
  await getDb().insert(appSettings).values({ key: 'home', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return value;
}
