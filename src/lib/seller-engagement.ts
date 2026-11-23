import { sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { sellerProfiles, users } from '../db/schema';

/** The windows the admin can pick, in days. */
export const ENGAGEMENT_WINDOWS = [7, 30, 90] as const;
export const DEFAULT_ENGAGEMENT_WINDOW = 30;

export const windowFrom = (v: unknown): number => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (ENGAGEMENT_WINDOWS as readonly number[]).includes(n) ? n : DEFAULT_ENGAGEMENT_WINDOW;
};

/** Contact methods a visitor can use; `contact_<method>` is the event type. WhatsApp and website exist for workshops only. */
export const CONTACT_METHODS = ['call', 'whatsapp', 'email', 'instagram', 'youtube', 'website', 'copy'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export type SellerEngagement = {
  sellerId: string;
  name: string;
  /** Visitor-days that looked at one of the seller's listings. */
  viewers: number;
  /** Visitor-days that opened the contact options (not yet a contact). */
  openedContact: number;
  /** Visitor-days that really used a contact method (call, email, Instagram, ...). */
  contacted: number;
  byMethod: Record<ContactMethod, number>;
};
export type EngagementReport = {
  days: number;
  firstDay: string;
  /** Whole-site figures: a visitor-day that contacted two sellers counts once here, so this is not the sum of the rows. */
  totals: { viewers: number; openedContact: number; contacted: number; sellersContacted: number };
  rows: SellerEngagement[];
};

/**
 * Every event row is "one visitor, one listing, one type, one day", and the visitor id changes every UTC day (salted hash), so the closest thing to
 * a head count is the *visitor-day*: the same person on three days is three. Within one seller a visitor-day is counted once however many of the
 * seller's listings they touched.
 *
 * Artist-page contacts are not stored in product_events (they exist in GA4 only), so they are missing from these counts.
 */
export async function sellerEngagement({ days = DEFAULT_ENGAGEMENT_WINDOW, now = new Date() }: { days?: number; now?: Date } = {}): Promise<EngagementReport> {
  const window = windowFrom(days);
  const firstDay = new Date(now.getTime() - (window - 1) * 86_400_000).toISOString().slice(0, 10); // the last N UTC days, today included
  const db = getDb();

  // One flat list of (seller, type, visitor-day) from both event tables.
  const ev = sql`(
    select p.seller_id as seller_id, e.type as type, e.actor || '|' || e.day::text as vd
      from product_events e join products p on p.id = e.product_id where e.day >= ${firstDay}
    union
    select w.host_id, e.type, e.actor || '|' || e.day::text
      from workshop_events e join workshops w on w.id = e.workshop_id where e.day >= ${firstDay} and w.host_id is not null
  )`;
  const one = (where: ReturnType<typeof sql>) => sql<number>`(select count(distinct ev.vd) from ${ev} ev where ev.seller_id = ${sellerProfiles.userId} and ${where})`.mapWith(Number);
  const contactTypes = sql`ev.type like 'contact\\_%'`;
  const method = (m: ContactMethod) => one(sql`ev.type = ${'contact_' + m}`);

  const rows = await db.select({
    sellerId: sellerProfiles.userId, name: sellerProfiles.displayName, fallback: users.name,
    viewers: one(sql`ev.type = 'view'`), openedContact: one(sql`ev.type = 'contact'`), contacted: one(contactTypes),
    call: method('call'), whatsapp: method('whatsapp'), email: method('email'), instagram: method('instagram'), youtube: method('youtube'), website: method('website'), copy: method('copy'),
  }).from(sellerProfiles).innerJoin(users, sql`${users.id} = ${sellerProfiles.userId}`).where(sql`${users.active}`);

  const [t] = await db.select({
    viewers: sql<number>`(select count(distinct vd) from ${ev} ev where ev.type = 'view')`.mapWith(Number),
    openedContact: sql<number>`(select count(distinct vd) from ${ev} ev where ev.type = 'contact')`.mapWith(Number),
    contacted: sql<number>`(select count(distinct vd) from ${ev} ev where ${contactTypes})`.mapWith(Number),
    sellersContacted: sql<number>`(select count(distinct seller_id) from ${ev} ev where ${contactTypes})`.mapWith(Number),
  }).from(sql`(select 1) one`);

  const out: SellerEngagement[] = rows.map(r => ({
    sellerId: r.sellerId, name: r.name?.trim() || r.fallback, viewers: r.viewers, openedContact: r.openedContact, contacted: r.contacted,
    byMethod: { call: r.call, whatsapp: r.whatsapp, email: r.email, instagram: r.instagram, youtube: r.youtube, website: r.website, copy: r.copy },
  }));
  out.sort((a, b) => b.contacted - a.contacted || b.openedContact - a.openedContact || b.viewers - a.viewers || a.name.localeCompare(b.name));
  return { days: window, firstDay, totals: t, rows: out };
}
