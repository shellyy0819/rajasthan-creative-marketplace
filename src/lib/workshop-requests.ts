import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { workshopRequests } from '../db/schema';
import { verifyCityRef } from './city-ref';
import { ApiError } from './errors';
import { mailConfigured, sendMail } from './mailer';
import { normalizePhone } from './phone';
import { notifyTeam } from './workshop-notify';
import { isRequestImageUrl, storageConfig } from './storage';
import { EMAIL_RE, bad, int, obj, oneOf, optionalText, text } from './validate';

import { MAX_REQUEST_IMAGES } from './workshop-requests-shared';
export { MAX_REQUEST_IMAGES };
export const REQUEST_KINDS = ['workshop', 'meetup', 'popup', 'market'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const KIND_LABEL: Record<RequestKind, string> = { workshop: 'Workshop', meetup: 'Meetup', popup: 'Pop-up', market: 'Flea market' };

export type WorkshopRequest = {
  id: string; hostName: string; contactName: string; phone: string; email: string; city: string; venue: string; title: string;
  kind: RequestKind; description: string; startDate: string; endDate: string; startTime?: string; endTime?: string;
  status: 'unverified' | 'received'; emailVerified: boolean; images: string[]; seats?: number; priceType: 'FREE' | 'PAID'; pricePaise?: number; instagram?: string; website?: string; notes?: string; createdAt: string;
};

const toRequest = (r: typeof workshopRequests.$inferSelect): WorkshopRequest => ({
  id: r.id, hostName: r.hostName, contactName: r.contactName, phone: r.phone, email: r.email, city: r.city, venue: r.venue, title: r.title,
  kind: r.kind as RequestKind, description: r.description, startDate: r.startDate, endDate: r.endDate,
  ...(r.startTime ? { startTime: r.startTime } : {}), ...(r.endTime ? { endTime: r.endTime } : {}),
  ...(r.seats != null ? { seats: r.seats } : {}), priceType: r.priceType as 'FREE' | 'PAID', ...(r.pricePaise != null ? { pricePaise: r.pricePaise } : {}),
  ...(r.instagram ? { instagram: r.instagram } : {}), ...(r.website ? { website: r.website } : {}), ...(r.notes ? { notes: r.notes } : {}),
  status: r.status as 'unverified' | 'received', emailVerified: r.verifiedAt != null, images: r.images ?? [], createdAt: r.createdAt.toISOString(),
});

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
function optionalWebsite(v: unknown): string | undefined {
  const raw = optionalText(v, 'website', 300);
  if (!raw) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try { u = new URL(withScheme); } catch { throw bad('website must be a web address like example.com.'); }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) throw bad('website must be a web address like example.com.');
  return withScheme;
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
  const startDate = isoDate(raw.startDate, 'startDate');
  // No end date given: a one-day event, so it ends on the start date.
  const endDate = raw.endDate === undefined || raw.endDate === null || raw.endDate === '' ? startDate : isoDate(raw.endDate, 'endDate');
  if (endDate < startDate) throw bad('endDate cannot be before startDate.');
  const startTime = optionalTime(raw.startTime, 'startTime');
  const endTime = optionalTime(raw.endTime, 'endTime');
  if (startTime && endTime && endDate === startDate && endTime <= startTime) throw bad('endTime must be after startTime.');
  const priceType = oneOf(raw.priceType, 'priceType', ['FREE', 'PAID'] as const);
  const pricePaise = priceType === 'PAID' ? int(raw.priceRupees, 'priceRupees', 1, 1_000_000) * 100 : null;
  const seats = raw.seats === undefined || raw.seats === null || raw.seats === '' ? null : int(raw.seats, 'seats', 1, 100_000);
  const [row] = await getDb().insert(workshopRequests).values({
    hostName: text(raw.hostName, 'hostName', 150), contactName: text(raw.contactName, 'contactName', 100), phone: `+91${phone.slice(-10)}`, email,
    city: cityLabel(raw.cityRef), venue: text(raw.venue, 'venue', 300), title: text(raw.title, 'title', 150),
    kind: oneOf(raw.kind, 'kind', REQUEST_KINDS), description: text(raw.description, 'description', 2000),
    startDate, endDate, startTime: startTime ?? null, endTime: endTime ?? null, seats, priceType, pricePaise,
    instagram: optionalText(raw.instagram, 'instagram', 200) ?? null, website: optionalWebsite(raw.website) ?? null, notes: optionalText(raw.notes, 'notes', 2000) ?? null, images: requestImages(raw.images),
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
  return (await getDb().select().from(workshopRequests).where(eq(workshopRequests.status, 'received'))
    .orderBy(desc(workshopRequests.createdAt), desc(workshopRequests.id))).map(toRequest);
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
      to: email, subject: 'Your Craftofy verification code',
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
