import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toAdminProduct, toAdminWorkshop, withPrices, workshopsQuery } from '../db/mappers';
import { ROLE_ID } from '../db/people';
import { products, sellerProfiles, userRoles, users, workshops as workshopsT } from '../db/schema';
import { listAdminWorkshops } from './catalog';
import { ApiError } from './errors';
import { artistSlug } from './artist-slug';
import { getProfileById } from './users';
import type { Workshop } from './types';

export type SellerSummary = {
  userId: string; /** Public profile page: /artists/<slug>. */ slug: string; accountEmail: string; displayName: string; category?: string; bio?: string; logoUrl?: string; city?: string;
  phone?: string; whatsapp?: string; instagram?: string; website?: string; publicEmail?: string; roles: string[];
};
export type SellerProduct = { id: string; name: string; category: string; pricePaise: number | null; status: string; stock: number };
export type WorkshopSellerDetail = {
  workshop: Workshop;
  /** How the seller was found: the account named on the listing, the email it was made with, or the host name on a seller profile. */
  match: 'account' | 'email' | 'name' | null;
  seller: SellerSummary | null;
  otherWorkshops: Workshop[];
  products: SellerProduct[];
};

/** Everything an admin wants on one screen about a listing: the listing, who hosts it, their other workshops and their products. */
export async function getWorkshopSellerDetail(id: string): Promise<WorkshopSellerDetail> {
  const db = getDb();
  const [row] = await workshopsQuery(db).where(eq(workshopsT.id, id));
  if (!row) throw new ApiError(404, 'Workshop not found.');
  const [workshop] = await withPrices(db, [toAdminWorkshop(row)]);

  let userId: string | undefined = row.w.hostId ?? undefined;
  let match: WorkshopSellerDetail['match'] = userId ? 'account' : null;
  if (!userId && workshop.contactEmail) {
    const [u] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${workshop.contactEmail.toLowerCase()}`);
    if (u) { userId = u.id; match = 'email'; }
  }
  if (!userId) {
    const [p] = await db.select({ userId: sellerProfiles.userId }).from(sellerProfiles).where(sql`lower(${sellerProfiles.displayName}) = ${workshop.host.toLowerCase()}`).limit(1);
    if (p) { userId = p.userId; match = 'name'; }
  }
  if (!userId) return { workshop, match: null, seller: null, otherWorkshops: [], products: [] };

  const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  const profile = await getProfileById(userId);
  const roleRows = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId));
  const roles = (Object.keys(ROLE_ID) as (keyof typeof ROLE_ID)[]).filter(r => roleRows.some(x => x.roleId === ROLE_ID[r]));
  const seller: SellerSummary = {
    userId, slug: artistSlug(profile.displayName, userId), accountEmail: account?.email ?? '', displayName: profile.displayName, roles,
    ...(profile.category ? { category: profile.category } : {}), ...(profile.bio ? { bio: profile.bio } : {}), ...(profile.logoUrl ? { logoUrl: profile.logoUrl } : {}),
    ...(profile.city ? { city: profile.city } : {}), ...(profile.publicPhone ? { phone: profile.publicPhone } : {}), ...(profile.whatsapp ? { whatsapp: profile.whatsapp } : {}),
    ...(profile.instagram ? { instagram: profile.instagram } : {}), ...(profile.website ? { website: profile.website } : {}), ...(profile.publicEmail ? { publicEmail: profile.publicEmail } : {}),
  };

  const mine = (w: Workshop) => w.id !== workshop.id && (
    w.hostId === userId
    || (!!w.contactEmail && w.contactEmail.toLowerCase() === seller.accountEmail.toLowerCase())
    || w.host.toLowerCase() === seller.displayName.toLowerCase());
  const otherWorkshops = (await listAdminWorkshops()).filter(mine);

  const productRows = await productsQuery(db).where(eq(products.sellerId, userId));
  const productList = productRows.map(toAdminProduct).map(p => ({ id: p.id, name: p.name, category: p.category, pricePaise: p.pricePaise ?? null, status: p.status, stock: p.stock }));
  return { workshop, match, seller, otherWorkshops, products: productList };
}
