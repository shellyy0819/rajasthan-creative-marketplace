import { sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toAdminWorkshop, withPrices, workshopsQuery } from '../db/mappers';
import { users, workshops as workshopsT } from '../db/schema';
import { updateWorkshop } from './admin';
import type { Workshop } from './types';

/** A workshop is a seller's own when it is linked to their account, or was made with their account email as its private contact. */
const mine = (w: Workshop, userId: string | undefined, email: string) =>
  (!!userId && w.hostId === userId) || (!!w.contactEmail && w.contactEmail.toLowerCase() === email.toLowerCase());

async function userIdOf(email: string): Promise<string | undefined> {
  const [u] = await getDb().select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  return u?.id;
}

/** The workshops a seller can see and edit on their dashboard, newest first. */
export async function listSellerWorkshops(email: string): Promise<Workshop[]> {
  const userId = await userIdOf(email);
  const rows = await workshopsQuery(getDb()).orderBy(sql`length(${workshopsT.id}) desc`, sql`${workshopsT.id} desc`);
  return withPrices(getDb(), rows.map(toAdminWorkshop).filter(w => mine(w, userId, email)));
}

/**
 * A seller edits their own workshop. Edits to a published workshop stay published: the status, the account link and the request it came
 * from belong to the team, so whatever the seller sends for them is ignored. Someone else's workshop is "not found".
 */
export async function updateOwnWorkshop(id: string, input: unknown, email: string): Promise<Workshop> {
  const userId = await userIdOf(email);
  const body = input && typeof input === 'object' && !Array.isArray(input) ? { ...(input as Record<string, unknown>) } : {};
  delete body.hostId; delete body.sourceRequestId;
  // Ownership and the kept status are checked on the row locked by the update itself.
  return updateWorkshop(id, body, { owns: w => mine(w, userId, email), keepStatus: true });
}
