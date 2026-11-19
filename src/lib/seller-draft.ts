import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { ROLE_ID } from '../db/people';
import { cities, userRoles, users } from '../db/schema';
import { createWorkshop } from './admin';
import { roleFor } from './authz';
import type { Workshop } from './types';
import type { WorkshopRequest } from './workshop-requests';

/** The seller account (not an admin) behind an email, if there is an active one. */
async function sellerIdFor(email: string): Promise<string | undefined> {
  if (roleFor(email) === 'admin') return undefined;
  const db = getDb();
  const [u] = await db.select({ id: users.id, active: users.active }).from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  if (!u || !u.active) return undefined;
  const roles = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, u.id));
  const has = (r: keyof typeof ROLE_ID) => roles.some(x => x.roleId === ROLE_ID[r]);
  return has('seller') && !has('admin') ? u.id : undefined;
}

/** "Name, State" as a request stores it, back to a city row. */
async function cityIdFor(label: string): Promise<number | undefined> {
  const i = label.lastIndexOf(', ');
  const name = i > 0 ? label.slice(0, i) : label, state = i > 0 ? label.slice(i + 2) : '';
  const rows = await getDb().select({ id: cities.id, state: cities.state }).from(cities).where(sql`lower(${cities.name}) = ${name.trim().toLowerCase()}`);
  const hit = rows.find(c => !state || (c.state ?? '').toLowerCase() === state.trim().toLowerCase());
  return hit?.id;
}

/**
 * A seller's own confirmed request becomes a Draft listing linked to them, so it shows in My Workshops at once; the team publishes it.
 * Requests from anyone else (no account, a customer, an admin) stay requests for the team to list. Returns null when nothing was drafted,
 * for example when an in-person city cannot be matched: the request is then left as it is.
 */
export async function draftForSeller(r: WorkshopRequest): Promise<Workshop | null> {
  // Only a request whose email was confirmed with the code: the email is what proves whose seller account this is.
  if (r.status !== 'received' || !r.emailVerified || r.listedWorkshopId) return null;
  const hostId = await sellerIdFor(r.email);
  if (!hostId) return null;
  const online = r.mode === 'online' || r.kind === 'class';
  const cityId = online ? null : await cityIdFor(r.city);
  if (!online && cityId === undefined) return null;
  const common = {
    status: 'DRAFT', hostId, sourceRequestId: r.id, title: r.title, description: r.description, host: r.hostName, topicId: r.topicId ?? null,
    instagram: r.instagram ?? null, website: r.website ?? null, images: r.images, contactName: r.contactName, contactPhone: r.phone, phonePublic: r.phonePublic, contactEmail: r.email,
    date: r.startDate, whatsapp: r.whatsapp ?? null,
  };
  const input = online ? {
    ...common, kind: 'class', mode: 'online', platform: r.platform ?? null, joinLink: r.joinLink ?? null, time: r.startTime ?? r.schedule?.time, endsOn: r.endsOn ?? r.startDate, schedule: r.schedule ?? null,
    venue: null, cityId: null, seats: null, prices: r.prices, freeTrial: r.freeTrial, freeTrialDays: r.freeTrialDays ?? null, languages: r.languages, level: r.level ?? null, experience: r.experience ?? null, certifications: r.certifications ?? null,
  } : {
    ...common, kind: r.kind, mode: 'in_person', venue: r.venue, cityId, time: r.startTime ?? '09:00', endsOn: r.endDate !== r.startDate ? r.endDate : null, seats: r.seats ?? 1,
    type: r.priceType, pricePaise: r.priceType === 'PAID' ? r.pricePaise ?? 0 : 0, platform: null, schedule: null, prices: [], languages: [], level: null, freeTrial: false,
  };
  try { return await createWorkshop(input); } catch { return null; } // a request that cannot be drafted stays a request
}
