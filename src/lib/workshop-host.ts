import { eq, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { sellerProfiles, users, workshops } from '../db/schema';

/**
 * The profile photo of the seller who hosts a workshop, for its public page: the account linked to it (host id), or the account whose email the
 * listing was made with. Only the photo address leaves here (https only); the email and everything else about the account stay private.
 */
export async function getWorkshopHostPhoto(workshopId: string): Promise<string | undefined> {
  const db = getDb();
  const [w] = await db.select({ hostId: workshops.hostId, email: workshops.contactEmail }).from(workshops).where(eq(workshops.id, workshopId));
  if (!w || (!w.hostId && !w.email)) return undefined;
  const rows = await db.select({ id: users.id, logo: sellerProfiles.logoUrl }).from(users)
    .innerJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(or(w.hostId ? eq(users.id, w.hostId) : undefined, w.email ? sql`lower(${users.email}) = ${w.email.toLowerCase()}` : undefined));
  // The account linked by id wins over one found by email.
  const best = rows.find(r => r.id === w.hostId && r.logo) ?? rows.find(r => r.logo);
  return best?.logo && /^https:\/\//i.test(best.logo) ? best.logo : undefined;
}
