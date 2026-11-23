import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { DEFAULT_HOME_PRODUCT_LIMIT, MAX_HOME_PRODUCT_LIMIT, MIN_HOME_PRODUCT_LIMIT } from './catalog-shared';
import { bad, int, obj } from './validate';

/** What an admin controls about the home page. `productLimit` is how many products the "Finds" shelf shows (the rest is on /shop). */
export type HomeSettings = { productLimit: number };
export const DEFAULT_HOME_SETTINGS: HomeSettings = { productLimit: DEFAULT_HOME_PRODUCT_LIMIT };

const valid = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= MIN_HOME_PRODUCT_LIMIT && n <= MAX_HOME_PRODUCT_LIMIT;

/** Never saved, or a stored value outside the bounds: the default, so a bad row can neither empty the shelf nor flood the page. */
export async function getHomeSettings(): Promise<HomeSettings> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'home'));
  const v = (row?.value as Partial<HomeSettings> | undefined)?.productLimit;
  return { productLimit: valid(v) ? v : DEFAULT_HOME_SETTINGS.productLimit };
}

export async function saveHomeSettings(input: unknown, actorEmail: string): Promise<HomeSettings> {
  const raw = obj(input);
  if (raw.productLimit === undefined) throw bad('productLimit is required.');
  const value: HomeSettings = { productLimit: int(raw.productLimit, 'productLimit', MIN_HOME_PRODUCT_LIMIT, MAX_HOME_PRODUCT_LIMIT) };
  await getDb().insert(appSettings).values({ key: 'home', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return value;
}
