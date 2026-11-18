import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import type { Q } from '../db/client';
import { workshopRequests, workshopTopics } from '../db/schema';
import { verifyCityRef } from './city-ref';
import { ApiError } from './errors';
import { mailConfigured, sendMail } from './mailer';
import { normalizePhone } from './phone';
import { contactEmail } from './site';
import { otpSender } from './settings';
import { notifyTeam } from './workshop-notify';
import { isRequestImageUrl, storageConfig } from './storage';
import { EMAIL_RE, bad, int, obj, oneOf, optionalText, text } from './validate';
import { CLASS_CONTACT_MESSAGE, optionalWebsite, parseListingFields, priceCache, type Level, type PriceRow, type Schedule } from './workshop-listing';

import { MAX_REQUEST_IMAGES } from './workshop-requests-shared';
export { MAX_REQUEST_IMAGES };
export const REQUEST_KINDS = ['workshop', 'meetup', 'popup', 'market', 'class'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const KIND_LABEL: Record<RequestKind, string> = { workshop: 'Workshop', meetup: 'Meetup', popup: 'Pop-up', market: 'Flea market', class: 'Online class' };

export type WorkshopRequest = {
  id: string; hostName: string; contactName: string; phone: string; email: string; city: string; venue: string; title: string;
  kind: RequestKind; mode: 'in_person' | 'online'; topicId?: number; topic?: string; description: string; startDate: string; endDate: string; startTime?: string; endTime?: string;
  status: 'unverified' | 'received' | 'listed'; emailVerified: boolean; images: string[]; seats?: number; priceType: 'FREE' | 'PAID'; pricePaise?: number; instagram?: string; website?: string; notes?: string; createdAt: string;
  endsOn?: string; platform?: string; schedule?: Schedule; languages: string[]; level?: Level; experience?: string; certifications?: string; freeTrial: boolean; freeTrialDays?: number; joinLink?: string; whatsapp?: string; prices: PriceRow[]; listedWorkshopId?: string;
};

const toRequest = (r: typeof workshopRequests.$inferSelect): WorkshopRequest => ({
  id: r.id, hostName: r.hostName, contactName: r.contactName, phone: r.phone, email: r.email, city: r.city ?? '', venue: r.venue ?? '', title: r.title,
  kind: r.kind as RequestKind, mode: r.mode as 'in_person' | 'online', ...(r.topicId != null ? { topicId: r.topicId } : {}), description: r.description, startDate: r.startDate, endDate: r.endDate,
  ...(r.startTime ? { startTime: r.startTime } : {}), ...(r.endTime ? { endTime: r.endTime } : {}),
  ...(r.seats != null ? { seats: r.seats } : {}), priceType: r.priceType as 'FREE' | 'PAID', ...(r.pricePaise != null ? { pricePaise: r.pricePaise } : {}),
  ...(r.instagram ? { instagram: r.instagram } : {}), ...(r.website ? { website: r.website } : {}), ...(r.notes ? { notes: r.notes } : {}),
  status: r.status as WorkshopRequest['status'], emailVerified: r.verifiedAt != null, images: r.images ?? [], createdAt: r.createdAt.toISOString(),
  ...(r.endsOn ? { endsOn: r.endsOn } : {}), ...(r.platform ? { platform: r.platform } : {}), ...(r.schedule ? { schedule: r.schedule as Schedule } : {}),
  languages: r.languages ?? [], ...(r.level ? { level: r.level as Level } : {}), ...(r.experience ? { experience: r.experience } : {}), ...(r.certifications ? { certifications: r.certifications } : {}),
  freeTrial: r.freeTrial, ...(r.freeTrialDays != null ? { freeTrialDays: r.freeTrialDays } : {}), ...(r.joinLink ? { joinLink: r.joinLink } : {}), ...(r.whatsapp ? { whatsapp: r.whatsapp } : {}), prices: (r.prices ?? []) as PriceRow[], ...(r.listedWorkshopId ? { listedWorkshopId: r.listedWorkshopId } : {}),
});

/** An admin made a listing from this request: remember which one, and take it out of the to-do state. Throws 400 when the request does not exist. */
export async function markRequestListed(q: Q, requestId: string, workshopId: string): Promise<void> {
  const [row] = await q.select({ status: workshopRequests.status }).from(workshopRequests).where(eq(workshopRequests.id, requestId)).for('update');
  if (!row) throw bad('sourceRequestId does not match a request.');
  if (row.status === 'listed') throw new ApiError(409, 'A listing was already made from this request.');
  await q.update(workshopRequests).set({ status: 'listed', listedWorkshopId: workshopId }).where(eq(workshopRequests.id, requestId));
}

/** The topic's name for display (the row only keeps the id). */
export async function withTopicName(r: WorkshopRequest): Promise<WorkshopRequest> {
  if (r.topicId == null || r.topic) return r;
  const [t] = await getDb().select({ name: workshopTopics.name }).from(workshopTopics).where(eq(workshopTopics.id, r.topicId));
  return t ? { ...r, topic: t.name } : r;
}

function isoDate(v: unknown, field: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw bad(`${field} must be a date like 2026-12-18.`);
  return s;
}
function optionalTime(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim())) throw bad(`${field} must be a time like 18:30.`);
  return v.trim();
}
/** Up to 3 distinct photo urls that were uploaded through the form's own upload area; anything else is refused. */
function requestImages(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_REQUEST_IMAGES) throw bad(`images must be a list of up to ${MAX_REQUEST_IMAGES} photo urls.`);
  const urls = [...new Set(v.map(u => (typeof u === 'string' ? u.trim() : '')))];
  if (!urls.length) return [];
  const cfg = storageConfig();
  if (!cfg || urls.some(u => !isRequestImageUrl(cfg, u))) throw bad('One or more photos are not allowed.');
  return urls;
}

/** The city must be a pick from the city search (signed reference); stored as "Name, State". */
function cityLabel(ref: unknown): string {
  const c = verifyCityRef(ref); // 400 "Invalid city selection." for anything else
  return c.state ? `${c.name}, ${c.state}` : c.name;
}

export async function createWorkshopRequest(input: unknown): Promise<WorkshopRequest> {
  await purgeUnverifiedWorkshopRequests();
  const raw = obj(input);
  const phone = typeof raw.phone === 'string' ? normalizePhone(raw.phone) : undefined;
  if (!phone) throw bad('phone must be a valid Indian mobile number, e.g. 9989898999.');
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) throw bad('email must be a valid email address.');
  const l = parseListingFields(raw);
  if (l.mode === 'hybrid') throw bad('mode must be in_person or online.');
  const online = l.mode === 'online';
  if ((online || l.kind === 'class') && !l.whatsapp && !l.instagram && !l.website) throw bad(CLASS_CONTACT_MESSAGE);
  const startDate = isoDate(raw.startDate, 'startDate');
  // No end date given: a one-day event, so it ends on the start date. An online class's own end date (endsOn) is its end date, and open-ended when blank.
  const endDate = online && l.endsOn ? l.endsOn : raw.endDate === undefined || raw.endDate === null || raw.endDate === '' ? startDate : isoDate(raw.endDate, 'endDate');
  if (endDate < startDate) throw bad(online ? 'endsOn cannot be before startDate.' : 'endDate cannot be before startDate.');
  const startTime = optionalTime(raw.startTime, 'startTime') ?? (online ? l.schedule?.time : undefined);
  const endTime = online ? undefined : optionalTime(raw.endTime, 'endTime');
  if (startTime && endTime && endDate === startDate && endTime <= startTime) throw bad('endTime must be after startTime.');
  let priceType: 'FREE' | 'PAID'; let pricePaise: number | null;
  if (l.prices.length) { const c = priceCache(l.prices); priceType = c.type; pricePaise = c.type === 'PAID' ? c.pricePaise : null; }
  else if (online && raw.priceType === undefined) { priceType = 'FREE'; pricePaise = null; }
  else { priceType = oneOf(raw.priceType, 'priceType', ['FREE', 'PAID'] as const); pricePaise = priceType === 'PAID' ? int(raw.priceRupees, 'priceRupees', 1, 1_000_000) * 100 : null; }
  const seats = online || raw.seats === undefined || raw.seats === null || raw.seats === '' ? null : int(raw.seats, 'seats', 1, 100_000);
  if (l.topicId != null) {
    const [t] = await getDb().select({ id: workshopTopics.id }).from(workshopTopics).where(and(eq(workshopTopics.id, l.topicId), eq(workshopTopics.active, true)));
    if (!t) throw bad('topicId does not match a topic.');
  }
  const [row] = await getDb().insert(workshopRequests).values({
    hostName: text(raw.hostName, 'hostName', 150), contactName: text(raw.contactName, 'contactName', 100), phone: `+91${phone.slice(-10)}`, email,
    city: online ? null : cityLabel(raw.cityRef), venue: online ? null : text(raw.venue, 'venue', 300), title: text(raw.title, 'title', 150),
    kind: l.kind, mode: l.mode, topicId: l.topicId, description: text(raw.description, 'description', 2000),
    startDate, endDate, startTime: startTime ?? null, endTime: endTime ?? null, seats, priceType, pricePaise,
    instagram: l.instagram, website: l.website, notes: optionalText(raw.notes, 'notes', 2000) ?? null, images: requestImages(raw.images),
    endsOn: online ? l.endsOn : null, platform: online ? l.platform : null, schedule: online ? l.schedule : null, languages: l.languages, level: l.level,
    experience: l.experience, certifications: l.certifications, freeTrial: l.freeTrial, freeTrialDays: l.freeTrialDays, joinLink: online ? l.joinLink : null, whatsapp: l.whatsapp, prices: l.prices,
  }).returning();
  try {
    await issueCode(row.id, row.email);
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) {
      // Email cannot go out right now (not set up, or the provider refused). The visitor's details are good, so keep them for the admins
      // as a received request whose email is not confirmed, instead of failing the visitor over something they cannot fix.
      const [kept] = await getDb().update(workshopRequests).set({ status: 'received', codeHash: null, codeExpiresAt: null }).where(eq(workshopRequests.id, row.id)).returning();
      return toRequest(kept ?? { ...row, status: 'received' });
    }
    await getDb().delete(workshopRequests).where(eq(workshopRequests.id, row.id)); // anything else went wrong: keep no half-finished request
    throw e;
  }
  return toRequest(row);
}

/** Requests whose email was confirmed with the emailed code, plus ones kept as received because the code email could not be sent (see emailVerified). */
export async function listWorkshopRequests(): Promise<WorkshopRequest[]> {
  const rows = await getDb().select().from(workshopRequests).where(inArray(workshopRequests.status, ['received', 'listed']))
    .orderBy(desc(workshopRequests.createdAt), desc(workshopRequests.id));
  return Promise.all(rows.map(r => withTopicName(toRequest(r))));
}

// ---- email verification: a 6-digit code, valid 10 minutes, 5 tries per code, 5 emails per request, 60 seconds between emails ----
export const CODE_TTL_MS = 10 * 60_000;
export const MAX_CODE_TRIES = 5;
export const MAX_CODE_SENDS = 5;
export const RESEND_AFTER_MS = 60_000;
const UNVERIFIED_KEEP_MS = 24 * 60 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not set; cannot hash verification codes.');
  return s;
}
const hashCode = (id: string, code: string) => createHmac('sha256', secret()).update(`${id}:${code}`).digest('hex');

/** Makes a fresh code for the request, stores only its hash and emails it. Email not set up, or not sendable, is a 503 (a new request is then kept without a code, see createWorkshopRequest). */
async function issueCode(id: string, email: string): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  if (!(await mailConfigured())) throw new ApiError(503, 'Email verification is not set up yet. Please try again later.');
  const now = new Date();
  await getDb().update(workshopRequests).set({
    codeHash: hashCode(id, code), codeExpiresAt: new Date(now.getTime() + CODE_TTL_MS), codeAttempts: 0, codeSentAt: now, codeSends: sql`${workshopRequests.codeSends} + 1`,
  }).where(eq(workshopRequests.id, id));
  try {
    await sendMail({
      to: email, from: await otpSender(), replyTo: contactEmail(), // a reply to the no-reply address would go nowhere, so it goes to the team
      subject: 'Your Craftofy verification code',
      text: `Your Craftofy verification code is ${code}.\n\nIt expires in 10 minutes. If you did not ask to host a workshop on Craftofy, you can ignore this email.\n`,
    });
  } catch (e) {
    console.error('could not send the verification email:', (e as Error)?.message ?? 'error');
    throw new ApiError(503, 'We could not send the code right now. Please try again in a few minutes.');
  }
}

async function loadUnverified(id: unknown) {
  if (typeof id !== 'string' || !UUID.test(id)) throw new ApiError(404, 'Request not found.');
  const [row] = await getDb().select().from(workshopRequests).where(eq(workshopRequests.id, id));
  if (!row) throw new ApiError(404, 'Request not found.');
  return row;
}

/** Emails a new code. Allowed once a minute and at most 5 times per request. */
export async function resendWorkshopRequestCode(id: unknown): Promise<void> {
  const row = await loadUnverified(id);
  if (row.status !== 'unverified') throw new ApiError(409, 'This email is already verified.');
  if (row.codeSends >= MAX_CODE_SENDS) throw new ApiError(429, 'Too many codes sent. Please submit the form again.');
  if (row.codeSentAt && Date.now() - row.codeSentAt.getTime() < RESEND_AFTER_MS) throw new ApiError(429, 'Please wait a minute before asking for another code.');
  await issueCode(row.id, row.email);
}

/** Confirms the emailed code; the request then becomes visible to admins. Five wrong tries burn the code. */
export async function verifyWorkshopRequestCode(id: unknown, code: unknown): Promise<WorkshopRequest & { notified: boolean }> {
  const row = await loadUnverified(id);
  if (row.status === 'received') return { ...toRequest(row), notified: false };
  const given = typeof code === 'string' ? code.trim() : '';
  if (!/^\d{6}$/.test(given)) throw bad('code must be the 6 digits from the email.');
  if (!row.codeHash || !row.codeExpiresAt) throw new ApiError(400, 'Ask for a new code.');
  if (row.codeAttempts >= MAX_CODE_TRIES) throw new ApiError(429, 'Too many wrong codes. Ask for a new code.');
  if (row.codeExpiresAt.getTime() < Date.now()) throw new ApiError(400, 'That code has expired. Ask for a new code.');
  const db = getDb();
  const a = Buffer.from(hashCode(row.id, given)), b = Buffer.from(row.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(workshopRequests).set({ codeAttempts: sql`${workshopRequests.codeAttempts} + 1` }).where(eq(workshopRequests.id, row.id));
    throw new ApiError(400, 'That code is not right. Check the email and try again.');
  }
  const [done] = await db.update(workshopRequests).set({ status: 'received', verifiedAt: new Date(), codeHash: null, codeExpiresAt: null })
    .where(and(eq(workshopRequests.id, row.id), eq(workshopRequests.status, 'unverified'))).returning();
  const confirmed = toRequest(done ?? { ...row, status: 'received', verifiedAt: new Date() });
  // Only the call that confirmed it tells the team, so repeating the call never sends a second email.
  return { ...confirmed, notified: done ? await notifyTeam(confirmed, KIND_LABEL[confirmed.kind]) : false };
}

/** Drops requests that never confirmed their email within a day. */
export async function purgeUnverifiedWorkshopRequests(): Promise<void> {
  await getDb().delete(workshopRequests).where(and(eq(workshopRequests.status, 'unverified'), lt(workshopRequests.createdAt, new Date(Date.now() - UNVERIFIED_KEEP_MS))));
}
