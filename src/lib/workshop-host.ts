import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { sellerProfiles, users, workshops } from '../db/schema';
import { publicLogo } from './public-logo';

/**
 * The profile photo of the seller who hosts a workshop, for its public page: the account linked to it (host id), or the account whose email the
 * listing was made with. Only the photo address leaves here (https only); the email and everything else about the account stay private.
 */
export async function getWorkshopHostPhoto(workshopId: string): Promise<string | undefined> {
  const db = getDb();
  const [w] = await db.select({ hostId: workshops.hostId, email: workshops.contactEmail }).from(workshops).where(eq(workshops.id, workshopId));
  if (!w || (!w.hostId && !w.email)) return undefined;
  // A class linked to a seller by id belongs to that account alone: no photo from another account, even if the contact email matches one.
  // Only a class with no link falls back to the account its contact email names (an email the team entered or the host confirmed).
  const rows = await db.select({ id: users.id, logo: sellerProfiles.logoUrl }).from(users)
    .innerJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(w.hostId ? eq(users.id, w.hostId) : sql`lower(${users.email}) = ${w.email!.toLowerCase()}`);
  const hit = rows.find(r => r.logo && publicLogo(r.id, r.logo));
  return hit?.logo ?? undefined;
}
