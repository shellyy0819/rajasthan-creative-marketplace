import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toAdminWorkshop, toBooking, workshopsQuery } from '../db/mappers';
import { bookings as bookingsT, users, workshops as workshopsT } from '../db/schema';
import { ownsWorkshop } from './seller-workshops';
import type { Booking, Workshop } from './types';

/** What a booking's status code means to the host and the team (the code names are historical; no payment is collected on Craftofy). */
export const BOOKING_STATUS_LABEL: Record<string, string> = {
  CONFIRMED_FREE_DEMO: 'Confirmed (free)',
  DEMO_BOOKING_CREATED: 'Reserved: pays the host directly',
};

export type WorkshopBookings = { workshop: Workshop; bookings: Booking[] };

/**
 * The reservations for one workshop, newest first, for the dashboard. An admin may open any workshop; a seller only their own (anyone
 * else's is undefined, which the page shows as "not found"). The visitors' names and emails are private: nothing else calls this.
 */
export async function listWorkshopBookings(workshopId: string, user: { email: string; role: 'admin' | 'seller' }): Promise<WorkshopBookings | undefined> {
  if (!/^w\d+$/.test(workshopId)) return undefined;
  const db = getDb();
  const [row] = await workshopsQuery(db).where(eq(workshopsT.id, workshopId));
  if (!row) return undefined;
  const workshop = toAdminWorkshop(row);
  if (user.role !== 'admin' && !(await ownsWorkshop(workshop, user.email))) return undefined;
  const rows = await db.select({ b: bookingsT, email: users.email }).from(bookingsT)
    .innerJoin(users, eq(users.id, bookingsT.userId)).where(eq(bookingsT.workshopId, workshopId)).orderBy(desc(bookingsT.createdAt), desc(bookingsT.id));
  return { workshop, bookings: rows.map(r => toBooking(r.b, r.email)) };
}
