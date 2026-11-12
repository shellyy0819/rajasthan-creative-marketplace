import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { ROLE_ID, normEmail } from '../db/people';
import { userRoles, users } from '../db/schema';
import { mailConfigured, sendMail } from './mailer';
import { contactEmail } from './site';
import type { WorkshopRequest } from './workshop-requests';

/** Who hears about a new request: Craftofy's contact address plus every admin (ADMIN_EMAILS and active admins in the database), once each. */
export async function teamRecipients(): Promise<string[]> {
  const found = new Map<string, string>(); // lower-cased -> as written
  const add = (e: string) => { const n = normEmail(e); if (n && !found.has(n)) found.set(n, e.trim()); };
  add(contactEmail());
  for (const e of (process.env.ADMIN_EMAILS ?? '').split(',')) add(e);
  const admins = await getDb().select({ email: users.email }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.roleId, ROLE_ID.admin)))
    .where(eq(users.active, true));
  for (const a of admins) add(a.email);
  return [...found.values()];
}

const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();
const line = (label: string, value: string | number | undefined | null) => (value === undefined || value === null || value === '' ? '' : `${label}: ${value}\n`);

/** The email the team receives: every detail the visitor gave, laid out to read at a glance. */
export function notificationMail(r: WorkshopRequest, kindLabel: string): { subject: string; text: string } {
  const when = (r.startDate === r.endDate ? r.startDate : `${r.startDate} to ${r.endDate}`)
    + (r.startTime ? ` · ${r.startTime}${r.endTime ? `-${r.endTime}` : ''}` : r.endTime ? ` · until ${r.endTime}` : '');
  const price = r.priceType === 'PAID' && r.pricePaise != null ? `Rs. ${r.pricePaise / 100} per person` : 'Free';
  const text = [
    'A new host-a-workshop request was submitted, and the host confirmed their email.\n\n',
    line('Event', `${r.title} (${kindLabel})`), line('What happens', r.description), line('When', when), line('Where', `${r.venue}, ${r.city}`),
    line('Seats', r.seats ?? 'Open'), line('Price', price),
    '\n', line('Host / studio', r.hostName), line('Contact person', r.contactName), line('Phone', r.phone), line('Email', r.email),
    line('Instagram', r.instagram), line('Website', r.website), line('Notes', r.notes),
    r.images.length ? `Photos:\n${r.images.map(u => `  ${u}`).join('\n')}\n` : '',
    '\nReview it under Dashboard > Workshop requests. Reply to this email to write to the host.\n',
  ].join('');
  return { subject: oneLine(`New workshop request: ${r.title} (${kindLabel}, ${r.city})`), text };
}

/**
 * Emails the team about a confirmed request. Best effort: it returns whether the mail went out and never throws, because the visitor's
 * request is already saved and an email problem must not turn into an error for them. Does nothing when email is not set up.
 */
export async function notifyTeam(r: WorkshopRequest, kindLabel: string): Promise<boolean> {
  try {
    if (!(await mailConfigured())) return false;
    await sendMail({ to: await teamRecipients(), ...notificationMail(r, kindLabel), replyTo: r.email });
    return true;
  } catch (e) {
    console.error('could not email the team about workshop request', r.id, (e as Error)?.message ?? 'error');
    return false;
  }
}
