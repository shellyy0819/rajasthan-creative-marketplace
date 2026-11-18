import { asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AdminProduct, Booking, Order, OrderItem, Product, Workshop } from '../lib/types';
import type { Kind, Level, Mode, PriceRow, Schedule } from '../lib/workshop-listing';
import { artistSlug } from '../lib/artist-slug';
import { publicLogo } from '../lib/public-logo';
import type { Q } from './client';
import { bookings, cities, orderItems, orders, products, sellerProfiles, sourcingTypes, users, workshopPrices, workshopTopics, workshops } from './schema';

type ProductRow = typeof products.$inferSelect;
type WorkshopRow = typeof workshops.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type BookingRow = typeof bookings.$inferSelect;

// Optional fields are omitted (never null) so API JSON stays free of nulls.
const opt = <K extends string>(key: K, v: string | null | undefined) => (v == null ? {} : { [key]: v }) as Partial<Record<K, string>>;

/** The seller's profile city (a second join of `cities`, next to the product's own city). */
const artistCities = alias(cities, 'artist_cities');

// ---------- products (joined with the seller's user + public profile) ----------
export const sellerNameSql = sql<string>`coalesce(${sellerProfiles.displayName}, ${users.name})`;
export const productSelect = {
  p: products,
  cityName: cities.name,
  citySlug: cities.slug,
  cityState: cities.state,
  sellerName: sellerNameSql,
  sellerEmail: users.email,
  publicPhone: sellerProfiles.publicPhone,
  whatsapp: sellerProfiles.whatsapp,
  contactMethods: sellerProfiles.contactMethods,
  publicEmail: sellerProfiles.publicEmail,
  instagram: sellerProfiles.instagram,
  youtube: sellerProfiles.youtube,
  artistBio: sellerProfiles.bio,
  sellerLogo: sellerProfiles.logoUrl,
  artistCityName: artistCities.name,
  sourcingName: sourcingTypes.name,
  sourcingHandmade: sourcingTypes.countsAsHandmade,
  sourcingBadge: sourcingTypes.showBadge,
  images: sql<string[] | string>`coalesce((select json_agg(pim.url order by pim.position) from product_images pim where pim.product_id = ${products.id}), '[]'::json)`,
  likeCount: sql<number>`(select count(*) from product_likes pl where pl.product_id = ${products.id})`.mapWith(Number),
  publishedByEmail: sql<string | null>`(select pu.email from users pu where pu.id = ${products.publishedBy})`,
  workshopTitle: sql<string | null>`(select pw.title from workshops pw where pw.id = ${products.workshopId})`,
};
export type ProductJoinRow = {
  p: ProductRow; cityName: string; citySlug: string; cityState: string | null; sellerName: string; sellerEmail: string;
  publicPhone: string | null; whatsapp?: string | null; contactMethods: string[] | null; publicEmail: string | null; instagram: string | null; youtube: string | null; artistBio: string | null; sellerLogo?: string | null; artistCityName: string | null;
  sourcingName: string | null; sourcingHandmade: boolean | null; sourcingBadge: boolean | null;
  publishedByEmail: string | null; workshopTitle: string | null; likeCount: number; images: string[] | string;
};
/** SELECT products + seller + profile. Add .where(...) / .orderBy(...) / .for('update', { of: products }) as needed. */
export const productsQuery = (q: Q) =>
  q.select(productSelect).from(products)
    .innerJoin(cities, eq(cities.id, products.cityId))
    .leftJoin(sourcingTypes, eq(sourcingTypes.id, products.sourcingTypeId))
    .innerJoin(users, eq(users.id, products.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(artistCities, eq(artistCities.id, sellerProfiles.cityId));

const imagesOf = (v: string[] | string): string[] => (typeof v === 'string' ? (JSON.parse(v) as string[]) : v);

/**
 * A seller's public phone is shown only while Phone is one of their chosen contact methods. A seller with no
 * methods saved at all (an older or admin-created profile) keeps showing the phone they filled in.
 */
export const publicPhoneOf = (phone: string | null | undefined, methods: readonly string[] | null | undefined): string | undefined =>
  phone && (!methods?.length || methods.includes('phone')) ? phone : undefined;

/** A seller's WhatsApp number is public only while WhatsApp is one of their chosen contact methods. */
export const publicWhatsappOf = (whatsapp: string | null | undefined, methods: readonly string[] | null | undefined): string | undefined =>
  whatsapp && methods?.includes('whatsapp') ? whatsapp : undefined;

export const toProduct = (r: ProductJoinRow): Product => ({
  id: r.p.id, name: r.p.name, category: r.p.category, city: r.cityName, cityId: r.p.cityId, citySlug: r.citySlug, pricePaise: r.p.pricePaise,
  ...opt('cityState', r.cityState),
  ...(r.p.sourcingTypeId != null && r.sourcingName != null ? { sourcing: { id: r.p.sourcingTypeId, name: r.sourcingName, countsAsHandmade: !!r.sourcingHandmade, showBadge: !!r.sourcingBadge } } : {}),
  seller: r.sellerName, description: r.p.description, stock: r.p.stock, status: r.p.status,
  ...opt('instagram', r.instagram), ...opt('youtube', r.youtube), ...opt('phone', publicPhoneOf(r.publicPhone, r.contactMethods)), ...opt('whatsapp', publicWhatsappOf(r.whatsapp, r.contactMethods)),
  ...opt('email', r.publicEmail), ...opt('workshopId', r.p.workshopId),
  ...(imagesOf(r.images).length ? { images: imagesOf(r.images), imageUrl: imagesOf(r.images)[0] } : {}),
  likeCount: r.likeCount, sellerSlug: artistSlug(r.sellerName, r.p.sellerId),
  ...(r.sellerLogo && publicLogo(r.p.sellerId, r.sellerLogo) ? { sellerLogo: r.sellerLogo } : {}),
  ...opt('artistBio', r.artistBio), ...opt('artistCity', r.artistCityName),
});

export const toAdminProduct = (r: ProductJoinRow): AdminProduct => ({
  ...toProduct(r), sellerId: r.p.sellerId, sellerEmail: r.sellerEmail,
  ...opt('pickupLocation', r.p.pickupLocation), ...opt('publishedBy', r.p.publishedBy),
  ...opt('publishedAt', r.p.publishedAt?.toISOString()), ...opt('publishedByEmail', r.publishedByEmail), ...opt('workshopTitle', r.workshopTitle),
  createdAt: r.p.createdAt.toISOString(), updatedAt: r.p.updatedAt.toISOString(),
});

export type ProductInput = Omit<Product, 'id' | 'seller' | 'instagram' | 'youtube' | 'phone' | 'whatsapp' | 'email' | 'city' | 'citySlug' | 'cityState' | 'sourcing'> & { pickupLocation?: string; sourcingTypeId: number | null };
/** undefined → null so that UPDATE really clears a field (Drizzle ignores undefined keys). */
export const toProductRow = (p: ProductInput) => ({
  name: p.name, category: p.category, cityId: p.cityId, sourcingTypeId: p.sourcingTypeId, pricePaise: p.pricePaise, description: p.description,
  stock: p.stock, status: p.status, workshopId: p.workshopId ?? null,
  pickupLocation: p.pickupLocation ?? null,
});

// ---------- workshops (starts_at <-> the API's date + time strings, India time) ----------
export { istParts, istToDate } from '../lib/ist';
import { istParts, istToDate } from '../lib/ist';

export const workshopSelect = {
  w: workshops,
  cityName: cities.name,
  citySlug: cities.slug,
  cityState: cities.state,
  topicName: workshopTopics.name,
  topicSlug: workshopTopics.slug,
};
export type WorkshopJoinRow = { w: WorkshopRow; cityName: string | null; citySlug: string | null; cityState: string | null; topicName: string | null; topicSlug: string | null };
/** SELECT workshops + their city and topic (both optional: an online class has no city). Add .where(...) / .orderBy(...) / .for('update', { of: workshops }) as needed. */
export const workshopsQuery = (q: Q) =>
  q.select(workshopSelect).from(workshops)
    .leftJoin(cities, eq(cities.id, workshops.cityId))
    .leftJoin(workshopTopics, eq(workshopTopics.id, workshops.topicId));

export const toWorkshop = (r: WorkshopJoinRow): Workshop => ({
  id: r.w.id, title: r.w.title, type: r.w.type as Workshop['type'], pricePaise: r.w.pricePaise,
  kind: r.w.kind as Kind, mode: r.w.mode as Mode, topicId: r.w.topicId,
  ...(r.w.topicId != null && r.topicName && r.topicSlug ? { topic: { id: r.w.topicId, name: r.topicName, slug: r.topicSlug } } : {}),
  city: r.cityName, cityId: r.w.cityId, citySlug: r.citySlug, ...opt('cityState', r.cityState),
  venue: r.w.venue, ...istParts(r.w.startsAt), endsOn: r.w.endsOn, seats: r.w.seats, booked: r.w.booked, host: r.w.hostName,
  description: r.w.description, status: r.w.status,
  platform: r.w.platform, schedule: (r.w.schedule ?? null) as Schedule | null, languages: r.w.languages, level: r.w.level as Level | null,
  experience: r.w.experience, certifications: r.w.certifications, freeTrial: r.w.freeTrial, freeTrialDays: r.w.freeTrialDays,
  whatsapp: r.w.whatsapp, instagram: r.w.instagram, website: r.w.website, images: r.w.images, prices: [],
});
/** Admin responses also carry the host's user id and the private contact; the public API never does. */
export const toAdminWorkshop = (r: WorkshopJoinRow): Workshop => ({
  ...toWorkshop(r), ...opt('hostId', r.w.hostId), ...opt('contactName', r.w.contactName), ...opt('contactPhone', r.w.contactPhone),
  ...opt('contactEmail', r.w.contactEmail), ...opt('createdBy', r.w.createdBy), ...opt('sourceRequestId', r.w.sourceRequestId), ...opt('joinLink', r.w.joinLink), createdAt: r.w.createdAt.toISOString(),
});

/** Fills in the price rows (ordered) of each workshop with one query. */
export async function withPrices(q: Q, list: Workshop[]): Promise<Workshop[]> {
  if (!list.length) return list;
  const rows = await q.select().from(workshopPrices).where(inArray(workshopPrices.workshopId, list.map(w => w.id))).orderBy(asc(workshopPrices.position), asc(workshopPrices.id));
  const by = new Map<string, PriceRow[]>();
  for (const r of rows) by.set(r.workshopId, [...(by.get(r.workshopId) ?? []), { label: r.label, amountPaise: r.amountPaise, sessions: r.sessions }]);
  return list.map(w => ({ ...w, prices: by.get(w.id) ?? [] }));
}

export type WorkshopInput = Pick<Workshop, 'title' | 'type' | 'pricePaise' | 'kind' | 'mode' | 'topicId' | 'cityId' | 'venue' | 'date' | 'time' | 'endsOn' | 'seats' | 'host' | 'description' | 'status'
  | 'platform' | 'schedule' | 'languages' | 'level' | 'experience' | 'certifications' | 'freeTrial' | 'freeTrialDays' | 'whatsapp' | 'instagram' | 'website' | 'images'>
  & { contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; joinLink?: string | null };
export const toWorkshopRow = (w: WorkshopInput) => ({
  title: w.title, type: w.type, pricePaise: w.pricePaise, kind: w.kind, mode: w.mode, topicId: w.topicId, cityId: w.cityId, venue: w.venue,
  startsAt: istToDate(w.date, w.time), endsOn: w.endsOn, seats: w.seats, hostName: w.host, description: w.description, status: w.status,
  platform: w.platform, schedule: w.schedule, languages: w.languages, level: w.level, experience: w.experience, certifications: w.certifications,
  freeTrial: w.freeTrial, freeTrialDays: w.freeTrialDays, whatsapp: w.whatsapp, instagram: w.instagram, website: w.website, images: w.images,
  ...(w.contactName !== undefined ? { contactName: w.contactName } : {}), ...(w.contactPhone !== undefined ? { contactPhone: w.contactPhone } : {}),
  ...(w.contactEmail !== undefined ? { contactEmail: w.contactEmail } : {}), ...(w.joinLink !== undefined ? { joinLink: w.joinLink } : {}),
});

// ---------- orders & bookings ----------
const toItem = (i: OrderItemRow): OrderItem => ({
  productId: i.productId, name: i.name, seller: i.seller, quantity: i.quantity,
  unitPricePaise: i.unitPricePaise, lineTotalPaise: i.lineTotalPaise,
});

export const toOrder = (r: OrderRow, userEmail: string, items: OrderItemRow[]): Order => ({
  id: r.id, createdAt: r.createdAt.toISOString(), userEmail, customerName: r.customerName,
  email: r.email, items: items.map(toItem), totalPaise: r.totalPaise, status: r.status, note: r.note,
});

export const toBooking = (r: BookingRow, userEmail: string): Booking => ({
  id: r.id, createdAt: r.createdAt.toISOString(), userEmail, workshopId: r.workshopId,
  title: r.title, attendeeName: r.attendeeName, email: r.email, quantity: r.quantity,
  totalPaise: r.totalPaise, status: r.status, note: r.note,
});
