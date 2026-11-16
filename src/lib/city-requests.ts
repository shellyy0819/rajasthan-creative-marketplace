import { and, count, desc, eq, gt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { cityRequests, type CityRequestRow } from '../db/schema';
import { signCityRef, verifyCityRef } from './city-ref';
import { ApiError } from './errors';
import { addExtraArea, getExtraAreas, removeExtraArea } from './extra-areas';
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
/** How many places one seller can add in a day. */
export const DAILY_LIMIT = 10;
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
  const db = getDb();
  const existing = (await getExtraAreas()).find(a => a.osmType === pick.osmType && a.osmId === pick.osmId);
  if (existing) return { place: placeOf(existing, signCityRef(existing)), alreadyThere: true };
  const [{ n }] = await db.select({ n: count() }).from(cityRequests).where(and(eq(cityRequests.requestedBy, actor.email), gt(cityRequests.createdAt, new Date(Date.now() - 86_400_000))));
  if (n >= DAILY_LIMIT) throw new ApiError(429, 'You have added several places today. Please try again tomorrow, or write to us.');
  const areas = await addExtraArea({ ref: raw.ref, name }, actor.email);
  const area = areas.find(a => a.osmType === pick.osmType && a.osmId === pick.osmId)!;
  const [row] = await db.insert(cityRequests).values({
    requestedBy: actor.email, requestedByName: actor.name?.trim() || null, name: area.name, placeLabel: pick.state ? `${pick.name}, ${pick.state}` : pick.name,
    state: area.state ?? null, osmType: area.osmType, osmId: area.osmId, lat: area.lat, lng: area.lng, note: note ?? null,
  }).returning();
  const request = toRequest(row);
  await notifyTeam(request);
  return { place: placeOf(area, signCityRef(area)), alreadyThere: false, request };
}

export async function listCityRequests(): Promise<CityRequest[]> {
  return (await getDb().select().from(cityRequests).orderBy(desc(cityRequests.createdAt)).limit(500)).map(toRequest);
}

/** Requests are auto-approved, and the admin can change one whenever she needs: confirm it ('approve', which also restores a removed one) or take its place out of the City field ('remove'). Cities already created from it, and their products, stay either way. */
export async function decideCityRequest(id: string, input: unknown, adminEmail: string): Promise<CityRequest> {
  const decision = obj(input).decision;
  if (decision !== 'approve' && decision !== 'remove') throw bad('decision must be approve or remove.');
  if (!UUID.test(id)) throw new ApiError(404, 'Request not found.');
  const db = getDb();
  const [row] = await db.select().from(cityRequests).where(eq(cityRequests.id, id));
  if (!row) throw new ApiError(404, 'Request not found.');
  const area = { osmType: row.osmType, osmId: row.osmId };
  if (decision === 'remove') {
    try { await removeExtraArea(area, adminEmail); } catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }   // already gone from the list
  } else {
    const present = (await getExtraAreas()).some(a => a.osmType === row.osmType && a.osmId === row.osmId);
    if (!present) await addExtraArea({ ref: signCityRef({ osmType: row.osmType, osmId: row.osmId, name: row.name, ...(row.state ? { state: row.state } : {}), lat: row.lat, lng: row.lng }), name: row.name }, adminEmail);
  }
  const [updated] = await db.update(cityRequests).set({ status: decision === 'approve' ? 'approved' : 'removed', decidedAt: new Date(), decidedBy: adminEmail }).where(eq(cityRequests.id, id)).returning();
  return toRequest(updated);
}
