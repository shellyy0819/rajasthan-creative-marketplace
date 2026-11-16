import { and, count, desc, eq, gt, ne } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings, cityRequests, type CityRequestRow } from '../db/schema';
import { signCityRef, verifyCityRef } from './city-ref';
import { ApiError } from './errors';
import { addExtraArea, getExtraAreas, isRemovedPlace, markPlaceRemoved, removeExtraArea, renameExtraArea, withExtraAreasLock } from './extra-areas';
import { SELLER_AREA_LIMIT } from './extra-areas-shared';
import { mailConfigured, sendMail } from './mailer';
import { teamRecipients } from './workshop-notify';
import { bad, obj, optionalText, text } from './validate';

export type CityRequestStatus = 'live' | 'approved' | 'removed';
export type CityRequest = {
  id: string; requestedBy: string; requestedByName?: string; name: string; placeLabel: string; state?: string; note?: string;
  status: CityRequestStatus; createdAt: string; decidedAt?: string; decidedBy?: string;
};
/** The place a seller can pick in the City field straight away, with a fresh signed reference. */
export type AddedPlace = { label: string; name: string; state?: string; ref: string };
/** How many places one seller can add in a day, and how many all sellers together can add in a day, so no one can use up the shared list. */
export const DAILY_LIMIT = 10;
export const GLOBAL_DAILY_LIMIT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toRequest = (r: CityRequestRow): CityRequest => ({
  id: r.id, requestedBy: r.requestedBy, ...(r.requestedByName ? { requestedByName: r.requestedByName } : {}), name: r.name, placeLabel: r.placeLabel,
  ...(r.state ? { state: r.state } : {}), ...(r.note ? { note: r.note } : {}), status: r.status as CityRequestStatus,
  createdAt: r.createdAt.toISOString(), ...(r.decidedAt ? { decidedAt: r.decidedAt.toISOString() } : {}), ...(r.decidedBy ? { decidedBy: r.decidedBy } : {}),
});
const placeOf = (a: { name: string; state?: string }, ref: string): AddedPlace => ({ label: a.state ? `${a.name}, ${a.state}` : a.name, name: a.name, ...(a.state ? { state: a.state } : {}), ref });

const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();
/** The email the team receives: for information only, since the city was approved automatically. */
export function cityRequestMail(r: CityRequest): { subject: string; text: string } {
  const text = [
    `For your information: ${r.requestedByName ? `${r.requestedByName} (${r.requestedBy})` : r.requestedBy} created a new city request, because they could not find their city in the City field.\n\n`,
    `City shown: ${r.name}${r.state ? `, ${r.state}` : ''}\n`, `Found as: ${r.placeLabel}\n`, r.note ? `Note from the seller: ${r.note}\n` : '',
    '\nIt was approved automatically and is live in the City field now, so the seller can use it straight away. Nothing needs doing. If you want to change it, go to Dashboard > City requests: Confirm it, or Remove it whenever you like (cities already created from it, and their products, stay). You can restore a removed one too.\n',
  ].join('');
  return { subject: oneLine(`New city request (auto-approved): ${r.name}${r.state ? `, ${r.state}` : ''}, by ${r.requestedByName || r.requestedBy}`), text };
}

/** Tells the team once a day when the limit for all sellers is reached, with who added most, so they can look and remove any that should not be there (removed ones stop counting). */
async function alertDailyLimit(): Promise<void> {
  try {
    const db = getDb(), since = new Date(Date.now() - 86_400_000);
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, 'city-requests-cap-alert'));
    const last = Date.parse((row?.value as { at?: string } | undefined)?.at ?? '');
    if (Number.isFinite(last) && Date.now() - last < 86_400_000) return;
    const value = { at: new Date().toISOString() };
    await db.insert(appSettings).values({ key: 'city-requests-cap-alert', value, updatedBy: 'system' }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    if (!(await mailConfigured())) return;
    const top = await db.select({ email: cityRequests.requestedBy, n: count() }).from(cityRequests).where(and(gt(cityRequests.createdAt, since), ne(cityRequests.status, 'removed'))).groupBy(cityRequests.requestedBy).orderBy(desc(count())).limit(5);
    const total = top.reduce((a, t) => a + t.n, 0);
    await sendMail({ to: await teamRecipients(), subject: 'City requests: the daily limit was reached', text: [
      `Sellers have added ${GLOBAL_DAILY_LIMIT} or more cities in the last 24 hours, so new requests are being turned away until some of today's are removed or the day passes.\n\n`,
      `Who added the most (top ${top.length}${total ? `, ${total} between them` : ''}):\n`, ...top.map(t => `  ${t.email}: ${t.n}\n`),
      '\nLook at them under Dashboard > City requests and remove any that should not be there; removed ones stop counting towards the limit. You get this email at most once a day.\n',
    ].join('') });
  } catch (e) { console.error('could not send the city request limit alert', (e as Error)?.message ?? 'error'); }
}

/** Emails the team (Craftofy's contact address and the admins). Best effort: the city is already live and saved, so an email problem never becomes the seller's error. */
async function notifyTeam(r: CityRequest): Promise<boolean> {
  try {
    if (!(await mailConfigured())) return false;
    await sendMail({ to: await teamRecipients(), ...cityRequestMail(r), replyTo: r.requestedBy });
    return true;
  } catch (e) {
    console.error('could not email the team about city request', r.id, (e as Error)?.message ?? 'error');
    return false;
  }
}

/**
 * A seller adds the place they picked from the place search (`ref` is its signed reference) because the City field did not offer their city. It goes live at once,
 * added to the extra areas list so every seller sees it, and is saved and emailed to the team for review. Picking a place that is already offered changes nothing.
 */
export async function createCityRequest(input: unknown, actor: { email: string; name?: string }): Promise<{ place: AddedPlace; alreadyThere: boolean; request?: CityRequest }> {
  const raw = obj(input);
  const pick = verifyCityRef(raw.ref);
  const name = text(raw.name ?? pick.name, 'name', 80);
  if (name.length < 2) throw bad('name must be 2 to 80 characters.');
  const note = optionalText(raw.note, 'note', 300);
  const since = new Date(Date.now() - 86_400_000);
  // The checks and the changes happen under one lock, so two requests at the same moment cannot both slip past a limit or overwrite each other's change to the list.
  const done = await withExtraAreasLock(async q => {
    const areas = await getExtraAreas(q);
    const existing = areas.find(a => a.osmType === pick.osmType && a.osmId === pick.osmId);
    if (existing) return { place: placeOf(existing, signCityRef(existing)), alreadyThere: true as const };
    // A place the team has removed stays removed, whether or not anyone ever asked for it: asking again does not put it back. The admin can add it again or restore it.
    if (await isRemovedPlace(pick, q)) throw new ApiError(409, 'The Craftofy team has removed this place from the City field, so it cannot be added again. Please write to us if you need it.');
    const [{ mine }] = await q.select({ mine: count() }).from(cityRequests).where(and(eq(cityRequests.requestedBy, actor.email), gt(cityRequests.createdAt, since)));
    if (mine >= DAILY_LIMIT) throw new ApiError(429, 'You have added several places today. Please try again tomorrow, or write to us.');
    const [{ all }] = await q.select({ all: count() }).from(cityRequests).where(and(gt(cityRequests.createdAt, since), ne(cityRequests.status, 'removed')));   // removed ones free their place
    if (all >= GLOBAL_DAILY_LIMIT) return { capped: true as const };
    if (areas.length >= SELLER_AREA_LIMIT) throw new ApiError(409, 'The city list is full for now. Please write to us and we will add your city.');
    const saved = await addExtraArea({ ref: raw.ref, name }, actor.email, q);
    const area = saved.find(a => a.osmType === pick.osmType && a.osmId === pick.osmId)!;
    const [row] = await q.insert(cityRequests).values({
      requestedBy: actor.email, requestedByName: actor.name?.trim() || null, name: area.name, placeLabel: pick.state ? `${pick.name}, ${pick.state}` : pick.name,
      state: area.state ?? null, osmType: area.osmType, osmId: area.osmId, lat: area.lat, lng: area.lng, note: note ?? null,
    }).returning();
    return { place: placeOf(area, signCityRef(area)), alreadyThere: false as const, request: toRequest(row) };
  });
  if ('capped' in done) { await alertDailyLimit(); throw new ApiError(429, 'Many places were added today. Please try again tomorrow, or write to us.'); }
  if (!done.alreadyThere) await notifyTeam(done.request);
  return done;
}

export async function listCityRequests(): Promise<CityRequest[]> {
  return (await getDb().select().from(cityRequests).orderBy(desc(cityRequests.createdAt)).limit(500)).map(toRequest);
}

/** Requests are auto-approved, and the admin can change one whenever she needs: confirm it ('approve', which also restores a removed one), take its place out of the City field ('remove'), or give it another name ('rename'). Cities already created from it, and their products, stay either way. */
export async function decideCityRequest(id: string, input: unknown, adminEmail: string): Promise<CityRequest> {
  const body = obj(input), decision = body.decision;
  if (decision !== 'approve' && decision !== 'remove' && decision !== 'rename') throw bad('decision must be approve, remove or rename.');
  if (!UUID.test(id)) throw new ApiError(404, 'Request not found.');
  return withExtraAreasLock(async q => {
    const [row] = await q.select().from(cityRequests).where(eq(cityRequests.id, id));
    if (!row) throw new ApiError(404, 'Request not found.');
    const area = { osmType: row.osmType, osmId: row.osmId };
    if (decision === 'rename') {   // the status stays as it is; only the name changes
      const name = text(body.name, 'name', 80);
      if (name.length < 2) throw bad('name must be 2 to 80 characters.');
      if ((await getExtraAreas(q)).some(x => x.osmType === row.osmType && x.osmId === row.osmId)) await renameExtraArea({ ...area, name }, adminEmail, q);
      else await q.update(cityRequests).set({ name }).where(eq(cityRequests.id, id));   // a removed one: only the request's name changes, and a later restore uses it
      const [renamed] = await q.select().from(cityRequests).where(eq(cityRequests.id, id));
      return toRequest(renamed);
    }
    if (decision === 'remove') {
      try { await removeExtraArea(area, adminEmail, q); } catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }   // already gone from the list
      await markPlaceRemoved(area, adminEmail, q);
    } else {
      const present = (await getExtraAreas(q)).some(a => a.osmType === row.osmType && a.osmId === row.osmId);
      if (!present) await addExtraArea({ ref: signCityRef({ osmType: row.osmType, osmId: row.osmId, name: row.name, ...(row.state ? { state: row.state } : {}), lat: row.lat, lng: row.lng }), name: row.name }, adminEmail, q);
    }
    const [updated] = await q.update(cityRequests).set({ status: decision === 'approve' ? 'approved' : 'removed', decidedAt: new Date(), decidedBy: adminEmail }).where(eq(cityRequests.id, id)).returning();
    return toRequest(updated);
  });
}
