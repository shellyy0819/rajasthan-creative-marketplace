import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { users, workshops } from '../db/schema';
import { workshopSlug } from './catalog-shared';
import { getWorkshopPreview } from './catalog';
import { mailConfigured, sendMail } from './mailer';
import { money } from './money';
import { siteUrl } from './site';
import { teamRecipients } from './workshop-notify';
import type { Booking, Workshop } from './types';

const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();
const line = (label: string, value: string | number | undefined | null) => (value === undefined || value === null || value === '' ? '' : `${label}: ${value}\n`);

/** Where a booking is announced: the host's account email (the account linked to the workshop), else the workshop's private contact email; null when neither is known. */
export async function hostEmailFor(workshopId: string): Promise<string | null> {
  const db = getDb();
  const [w] = await db.select({ hostId: workshops.hostId, contactEmail: workshops.contactEmail }).from(workshops).where(eq(workshops.id, workshopId));
  if (!w) return null;
  if (w.hostId) {
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, w.hostId));
    if (u?.email) return u.email;
  }
  return w.contactEmail || null;
}

const when = (w: Workshop) => `${w.date}${w.time ? ` at ${w.time}` : ''}${w.endsOn && w.endsOn !== w.date ? ` (until ${w.endsOn})` : ''}`;
const where = (w: Workshop) => [w.venue, w.city].filter(Boolean).join(', ');
const totalText = (b: Booking) => (b.totalPaise > 0 ? `${money(b.totalPaise)} (pay the host directly; nothing is collected on Craftofy)` : 'Free');

/** The email the host gets: who reserved, how many seats, how to reach them (Reply goes to the visitor). */
export function hostMail(b: Booking, w: Workshop): { subject: string; text: string } {
  return {
    subject: oneLine(`New reservation: ${b.attendeeName} for ${w.title} (${b.quantity} seat${b.quantity === 1 ? '' : 's'})`),
    text: [
      `${oneLine(b.attendeeName)} reserved a spot in your workshop on Craftofy.\n\n`,
      line('Workshop', w.title), line('When', when(w)), line('Where', where(w)),
      '\n', line('Name', oneLine(b.attendeeName)), line('Email', oneLine(b.email)), line('Seats', b.quantity), line('Total', totalText(b)),
      line('Seats taken so far', w.seats != null ? `${w.booked} of ${w.seats}` : ''),
      `\nSee everyone who reserved on your Craftofy dashboard, under My workshops > Bookings. Reply to this email to write to ${oneLine(b.attendeeName)}.\n`,
    ].join(''),
  };
}

/** The confirmation the visitor gets. */
export function visitorMail(b: Booking, w: Workshop, origin: string = siteUrl()): { subject: string; text: string } {
  return {
    subject: oneLine(`Your spot is reserved: ${w.title}`),
    text: [
      `Hi ${oneLine(b.attendeeName)},\n\nYour reservation is in. Here are the details.\n\n`,
      line('Workshop', w.title), line('Hosted by', w.host), line('When', when(w)), line('Where', where(w)), line('Seats', b.quantity), line('Total', totalText(b)),
      `\nWorkshop page: ${origin}/workshops/${workshopSlug(w)}\n`,
      '\nThe host has been told and may write to you to share details. If you cannot come, please tell the host so the seat can go to someone else.\n',
    ].join(''),
  };
}

/**
 * Emails the host (or, when no host address is known, the Craftofy team) and confirms to the visitor. `visitorEmail` is the signed-in account's
 * address, which is verified; the address typed on the form is shown to the host as the way to reach them but never receives mail from us.
 * Best effort: it never throws, because the booking is already saved and an email problem must not turn into an error for the visitor.
 */
export async function notifyBooking(b: Booking, visitorEmail: string, origin: string = siteUrl()): Promise<{ host: boolean; visitor: boolean }> {
  const sent = { host: false, visitor: false };
  try {
    if (!(await mailConfigured())) return sent;
    const w = await getWorkshopPreview(b.workshopId);
    if (!w) return sent;
    const hostTo = await hostEmailFor(b.workshopId);
    await Promise.all([
      (async () => {
        try { await sendMail({ to: hostTo ?? await teamRecipients(), ...hostMail(b, w), replyTo: b.email }); sent.host = true; }
        catch (e) { console.error('could not email the host about booking', b.id, (e as Error)?.message ?? 'error'); }
      })(),
      (async () => {
        try { await sendMail({ to: visitorEmail, ...visitorMail(b, w, origin) }); sent.visitor = true; }
        catch (e) { console.error('could not email the booking confirmation', b.id, (e as Error)?.message ?? 'error'); }
      })(),
    ]);
  } catch (e) {
    console.error('could not notify about booking', b.id, (e as Error)?.message ?? 'error');
  }
  return sent;
}
