import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { ROLE_ID, ensureSellerProfile, ensureUser, normEmail } from '../db/people';
import { listingRequests, userRoles } from '../db/schema';
import { ApiError } from './errors';
import { normalizePhone } from './phone';
import { EMAIL_RE, bad, obj, oneOf, optionalText, text } from './validate';

export const LISTING_SIZES = ['small', 'medium', 'large'] as const;
export type ListingSize = (typeof LISTING_SIZES)[number];
export type ListingStatus = 'received' | 'confirmed';
export type ListingRequest = {
  id: string; ownerName: string; phone: string; email: string; instagram?: string; website?: string; businessName: string; size: ListingSize;
  status: ListingStatus; confirmedAt?: string; createdAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toRequest = (r: typeof listingRequests.$inferSelect): ListingRequest => ({
  id: r.id, ownerName: r.ownerName, phone: r.phone, email: r.email,
  ...(r.instagram ? { instagram: r.instagram } : {}), ...(r.website ? { website: r.website } : {}),
  businessName: r.businessName, size: r.size as ListingSize, status: r.status as ListingStatus,
  ...(r.confirmedAt ? { confirmedAt: r.confirmedAt.toISOString() } : {}), createdAt: r.createdAt.toISOString(),
});

/** Empty -> undefined; a bare domain gets https://; only http(s) urls with a dotted host are accepted. */
function optionalWebsite(v: unknown): string | undefined {
  const raw = optionalText(v, 'website', 300);
  if (!raw) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try { u = new URL(withScheme); } catch { throw bad('website must be a web address like example.com.'); }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) throw bad('website must be a web address like example.com.');
  if (withScheme.length > 300) throw bad('website must be a web address up to 300 characters.');
  return withScheme;
}

/** Canonical Indian mobile: +91 followed by the 10 digits. */
function indianPhone(v: unknown): string {
  const n = typeof v === 'string' ? normalizePhone(v) : undefined;
  if (!n) throw bad('phone must be a valid Indian mobile number, e.g. 9989898999.');
  return `+91${n.slice(-10)}`;
}

/** The email the owner will sign in with (Google). Stored lower-case. */
function ownerEmail(v: unknown): string {
  const e = typeof v === 'string' ? v.trim() : '';
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) throw bad('email must be a valid email address.');
  return normEmail(e);
}

export async function createListingRequest(input: unknown): Promise<ListingRequest> {
  const raw = obj(input);
  const v = {
    ownerName: text(raw.ownerName, 'ownerName', 100),
    phone: indianPhone(raw.phone),
    email: ownerEmail(raw.email),
    instagram: optionalText(raw.instagram, 'instagram', 200) ?? null,
    website: optionalWebsite(raw.website) ?? null,
    businessName: text(raw.businessName, 'businessName', 150),
    size: oneOf(raw.size, 'size', LISTING_SIZES),
  };
  const [row] = await getDb().insert(listingRequests).values(v).returning(); // status is always 'received' here
  return toRequest(row);
}

export async function listListingRequests(): Promise<ListingRequest[]> {
  return (await getDb().select().from(listingRequests).orderBy(desc(listingRequests.createdAt), desc(listingRequests.id))).map(toRequest);
}

/**
 * An admin confirms a request after calling the owner: the owner's email becomes a seller account (public profile named after
 * the business), so signing in with Google on that email opens the seller dashboard. Idempotent; the phone and Instagram stay private.
 */
export async function confirmListingRequest(id: string, actorEmail: string): Promise<ListingRequest> {
  if (!UUID.test(id)) throw new ApiError(404, 'Listing request not found.');
  return getDb().transaction(async tx => {
    const [req] = await tx.select().from(listingRequests).where(eq(listingRequests.id, id)).for('update');
    if (!req) throw new ApiError(404, 'Listing request not found.');
    if (req.status === 'confirmed') return toRequest(req);
    const owner = await ensureUser(tx, req.email, req.ownerName);
    if (!owner.active) throw new ApiError(409, 'That account is deactivated. Reactivate it under Users first.');
    const me = await ensureUser(tx, actorEmail);
    await tx.insert(userRoles).values({ userId: owner.id, roleId: ROLE_ID.seller, assignedBy: me.id }).onConflictDoNothing();
    await ensureSellerProfile(tx, owner.id, req.businessName);
    const [done] = await tx.update(listingRequests).set({ status: 'confirmed', confirmedAt: new Date(), confirmedBy: me.id }).where(eq(listingRequests.id, id)).returning();
    return toRequest(done);
  });
}
