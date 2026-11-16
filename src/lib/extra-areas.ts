import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { verifyCityRef } from './city-ref';
import { ApiError } from './errors';
import { DEFAULT_EXTRA_AREAS, MAX_EXTRA_AREAS, type ExtraArea } from './extra-areas-shared';
import { bad, obj, text } from './validate';

const KEY = 'extra-areas';
const sameArea = (a: Pick<ExtraArea, 'osmType' | 'osmId'>, b: Pick<ExtraArea, 'osmType' | 'osmId'>) => a.osmType === b.osmType && a.osmId === b.osmId;

function clean(v: unknown): ExtraArea | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (typeof a.name !== 'string' || !a.name.trim() || typeof a.osmType !== 'string' || typeof a.osmId !== 'number' || !Number.isInteger(a.osmId) || typeof a.lat !== 'number' || typeof a.lng !== 'number') return null;
  const aliases = Array.isArray(a.aliases) ? a.aliases.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 5) : [];
  return { name: a.name.trim(), osmType: a.osmType, osmId: a.osmId, lat: a.lat, lng: a.lng, ...(typeof a.state === 'string' && a.state ? { state: a.state } : {}), aliases };
}

/** The areas the City field offers. Until an admin saves the list it is the default (Hyderabad Shaikpet); after that the saved list is the whole truth, even when empty. */
export async function getExtraAreas(): Promise<ExtraArea[]> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, KEY));
  const v = row?.value as { areas?: unknown } | undefined;
  if (!v || !Array.isArray(v.areas)) return [...DEFAULT_EXTRA_AREAS];
  return v.areas.flatMap(a => { const c = clean(a); return c ? [c] : []; });
}

async function save(areas: ExtraArea[], actorEmail: string): Promise<ExtraArea[]> {
  await getDb().insert(appSettings).values({ key: KEY, value: { areas }, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: { areas }, updatedBy: actorEmail, updatedAt: new Date() } });
  return areas;
}

/**
 * Adds the area an admin picked from the area search (`ref` is that result's signed reference) under the display name they chose. Adding one that is already there
 * only changes its name. The area's own OpenStreetMap name stays searchable as an alias.
 */
export async function addExtraArea(input: unknown, actorEmail: string): Promise<ExtraArea[]> {
  const raw = obj(input);
  const pick = verifyCityRef(raw.ref);
  const name = text(raw.name ?? pick.name, 'name', 80);
  if (name.length < 2) throw bad('name must be 2 to 80 characters.');
  const current = await getExtraAreas();
  if (!current.some(a => sameArea(a, pick)) && current.length >= MAX_EXTRA_AREAS) throw new ApiError(400, `At most ${MAX_EXTRA_AREAS} extra areas.`);
  const area: ExtraArea = { name, osmType: pick.osmType, osmId: pick.osmId, lat: pick.lat, lng: pick.lng, ...(pick.state ? { state: pick.state } : {}), aliases: name.toLowerCase() === pick.name.toLowerCase() ? [] : [pick.name] };
  return save([...current.filter(a => !sameArea(a, area)), area].sort((a, b) => a.name.localeCompare(b.name)), actorEmail);
}

/** Takes an area out of the City field's suggestions. Cities already created from it, and the products using them, are untouched. */
export async function removeExtraArea(input: unknown, actorEmail: string): Promise<ExtraArea[]> {
  const raw = obj(input);
  if (typeof raw.osmType !== 'string' || typeof raw.osmId !== 'number') throw bad('osmType and osmId are required.');
  const current = await getExtraAreas();
  if (!current.some(a => sameArea(a, { osmType: raw.osmType as string, osmId: raw.osmId as number }))) throw new ApiError(404, 'That area is not in the list.');
  return save(current.filter(a => !sameArea(a, { osmType: raw.osmType as string, osmId: raw.osmId as number })), actorEmail);
}
