import { and, eq, ne, sql } from 'drizzle-orm';
import { getDb, type Q } from '../db/client';
import { appSettings, cities, cityRequests } from '../db/schema';
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
export async function getExtraAreas(q: Q = getDb()): Promise<ExtraArea[]> {
  const [row] = await q.select().from(appSettings).where(eq(appSettings.key, KEY));
  const v = row?.value as { areas?: unknown } | undefined;
  if (!v || !Array.isArray(v.areas)) return [...DEFAULT_EXTRA_AREAS];
  return v.areas.flatMap(a => { const c = clean(a); return c ? [c] : []; });
}

async function save(q: Q, areas: ExtraArea[], actorEmail: string): Promise<ExtraArea[]> {
  await q.insert(appSettings).values({ key: KEY, value: { areas }, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: { areas }, updatedBy: actorEmail, updatedAt: new Date() } });
  return areas;
}

const REMOVED_KEY = 'extra-areas-removed';
const MAX_REMOVED = 1000;
type Place = Pick<ExtraArea, 'osmType' | 'osmId'>;
async function readRemoved(q: Q): Promise<Place[]> {
  const [row] = await q.select().from(appSettings).where(eq(appSettings.key, REMOVED_KEY));
  const v = row?.value as { places?: unknown } | undefined;
  return Array.isArray(v?.places) ? v!.places.filter((p): p is Place => !!p && typeof (p as Place).osmType === 'string' && typeof (p as Place).osmId === 'number') : [];
}
async function writeRemoved(q: Q, places: Place[], actorEmail: string): Promise<void> {
  const value = { places: places.slice(-MAX_REMOVED) };
  await q.insert(appSettings).values({ key: REMOVED_KEY, value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
}
/** Places an admin has taken out of the City field. A seller cannot put one back by asking again; the admin can add it again from Settings or restore it from City requests. */
export async function isRemovedPlace(place: Place, q: Q = getDb()): Promise<boolean> { return (await readRemoved(q)).some(p => sameArea(p, place)); }
/** Records that an admin took this place out, whether or not any seller ever asked for it. */
export async function markPlaceRemoved(place: Place, actorEmail: string, q?: Q): Promise<void> {
  await withExtraAreasLock(async tx => {
    const removed = await readRemoved(tx);
    if (!removed.some(p => sameArea(p, place))) await writeRemoved(tx, [...removed, { osmType: place.osmType, osmId: place.osmId }], actorEmail);
  }, q);
}

/**
 * Runs `fn` in a transaction that holds a lock on the list, so two changes at the same moment (two sellers, or a seller and an admin) cannot overwrite each other,
 * and a check made inside `fn` (a limit, a repeat) is still true when `fn` saves. Pass `q` when already inside a transaction.
 */
export async function withExtraAreasLock<T>(fn: (q: Q) => Promise<T>, q?: Q): Promise<T> {
  const run = async (tx: Q) => { await tx.execute(sql`select pg_advisory_xact_lock(hashtext('extra-areas'))`); return fn(tx); };
  return q ? run(q) : getDb().transaction(tx => run(tx));
}

/**
 * Adds the area picked from the area search (`ref` is that result's signed reference) under the display name chosen. Adding one that is already there
 * only changes its name. The area's own OpenStreetMap name stays searchable as an alias.
 */
export async function addExtraArea(input: unknown, actorEmail: string, q?: Q): Promise<ExtraArea[]> {
  const raw = obj(input);
  const pick = verifyCityRef(raw.ref);
  const name = text(raw.name ?? pick.name, 'name', 80);
  if (name.length < 2) throw bad('name must be 2 to 80 characters.');
  return withExtraAreasLock(async tx => {
    const current = await getExtraAreas(tx);
    if (!current.some(a => sameArea(a, pick)) && current.length >= MAX_EXTRA_AREAS) throw new ApiError(400, `At most ${MAX_EXTRA_AREAS} extra areas.`);
    const area: ExtraArea = { name, osmType: pick.osmType, osmId: pick.osmId, lat: pick.lat, lng: pick.lng, ...(pick.state ? { state: pick.state } : {}), aliases: name.toLowerCase() === pick.name.toLowerCase() ? [] : [pick.name] };
    const saved = await save(tx, [...current.filter(a => !sameArea(a, area)), area].sort((a, b) => a.name.localeCompare(b.name)), actorEmail);
    const removed = await readRemoved(tx);   // adding a place again (by an admin, or restoring it) lifts the ban on asking for it
    if (removed.some(p => sameArea(p, area))) await writeRemoved(tx, removed.filter(p => !sameArea(p, area)), actorEmail);
    return saved;
  }, q);
}

/**
 * Renames an area: what the City field shows, the request that made it, and any city already created from it, so buyers see the new name in the filters too
 * (the city's web address stays as it was). The old name stays searchable as an alias, so sellers who know it by that name still find it.
 */
export async function renameExtraArea(input: unknown, actorEmail: string, q?: Q): Promise<ExtraArea[]> {
  const raw = obj(input);
  if (typeof raw.osmType !== 'string' || typeof raw.osmId !== 'number') throw bad('osmType and osmId are required.');
  const name = text(raw.name, 'name', 80);
  if (name.length < 2) throw bad('name must be 2 to 80 characters.');
  const target = { osmType: raw.osmType, osmId: raw.osmId };
  return withExtraAreasLock(async tx => {
    const current = await getExtraAreas(tx);
    const area = current.find(a => sameArea(a, target));
    if (!area) throw new ApiError(404, 'That area is not in the list.');
    if (area.name === name) return current;
    const aliases = [...new Set([...area.aliases, area.name])].filter(a => a.toLowerCase() !== name.toLowerCase()).slice(-5);   // the old name keeps finding it
    const next = await save(tx, current.map(a => (sameArea(a, target) ? { ...a, name, aliases } : a)).sort((a, b) => a.name.localeCompare(b.name)), actorEmail);
    await tx.update(cityRequests).set({ name }).where(and(eq(cityRequests.osmType, target.osmType), eq(cityRequests.osmId, target.osmId)));
    await tx.update(cities).set({ name }).where(and(eq(cities.osmType, target.osmType), eq(cities.osmId, target.osmId)));
    return next;
  }, q);
}

/**
 * Takes an area out of the City field's suggestions and records it as removed (and marks any seller's request for it), so it cannot be put back by asking again.
 * Cities already created from it, and the products using them, are untouched.
 */
export async function removeExtraArea(input: unknown, actorEmail: string, q?: Q): Promise<ExtraArea[]> {
  const raw = obj(input);
  if (typeof raw.osmType !== 'string' || typeof raw.osmId !== 'number') throw bad('osmType and osmId are required.');
  const target = { osmType: raw.osmType, osmId: raw.osmId };
  return withExtraAreasLock(async tx => {
    const current = await getExtraAreas(tx);
    if (!current.some(a => sameArea(a, target))) throw new ApiError(404, 'That area is not in the list.');
    const next = await save(tx, current.filter(a => !sameArea(a, target)), actorEmail);
    await markPlaceRemoved(target, actorEmail, tx);
    await tx.update(cityRequests).set({ status: 'removed', decidedAt: new Date(), decidedBy: actorEmail })
      .where(and(eq(cityRequests.osmType, target.osmType), eq(cityRequests.osmId, target.osmId), ne(cityRequests.status, 'removed')));
    return next;
  }, q);
}
