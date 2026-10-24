import { eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AdminProduct, Booking, Order, OrderItem, Product, Workshop } from '../lib/types';
import { artistSlug } from '../lib/artist-slug';
import type { Q } from './client';
import { bookings, cities, orderItems, orders, products, sellerProfiles, users, workshops } from './schema';

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
  publicEmail: sellerProfiles.publicEmail,
  instagram: sellerProfiles.instagram,
  youtube: sellerProfiles.youtube,
  artistBio: sellerProfiles.bio,
  artistCityName: artistCities.name,
  likeCount: sql<number>`(select count(*) from product_likes pl where pl.product_id = ${products.id})`.mapWith(Number),
  publishedByEmail: sql<string | null>`(select pu.email from users pu where pu.id = ${products.publishedBy})`,
  workshopTitle: sql<string | null>`(select pw.title from workshops pw where pw.id = ${products.workshopId})`,
};
export type ProductJoinRow = {
  p: ProductRow; cityName: string; citySlug: string; cityState: string | null; sellerName: string; sellerEmail: string;
  publicPhone: string | null; publicEmail: string | null; instagram: string | null; youtube: string | null; artistBio: string | null; artistCityName: string | null;
  publishedByEmail: string | null; workshopTitle: string | null; likeCount: number;
};
/** SELECT products + seller + profile. Add .where(...) / .orderBy(...) / .for('update', { of: products }) as needed. */
export const productsQuery = (q: Q) =>
  q.select(productSelect).from(products)
    .innerJoin(cities, eq(cities.id, products.cityId))
    .innerJoin(users, eq(users.id, products.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(artistCities, eq(artistCities.id, sellerProfiles.cityId));

export const toProduct = (r: ProductJoinRow): Product => ({
  id: r.p.id, name: r.p.name, category: r.p.category, city: r.cityName, cityId: r.p.cityId, citySlug: r.citySlug, pricePaise: r.p.pricePaise,
  ...opt('cityState', r.cityState),
  seller: r.sellerName, description: r.p.description, stock: r.p.stock, status: r.p.status,
  ...opt('instagram', r.instagram), ...opt('youtube', r.youtube), ...opt('phone', r.publicPhone),
  ...opt('email', r.publicEmail), ...opt('imageUrl', r.p.imageUrl), ...opt('workshopId', r.p.workshopId),
  likeCount: r.likeCount, sellerSlug: artistSlug(r.sellerName, r.p.sellerId),
  ...opt('artistBio', r.artistBio), ...opt('artistCity', r.artistCityName),
});

export const toAdminProduct = (r: ProductJoinRow): AdminProduct => ({
  ...toProduct(r), sellerId: r.p.sellerId, sellerEmail: r.sellerEmail,
  ...opt('pickupLocation', r.p.pickupLocation), ...opt('publishedBy', r.p.publishedBy),
  ...opt('publishedAt', r.p.publishedAt?.toISOString()), ...opt('publishedByEmail', r.publishedByEmail), ...opt('workshopTitle', r.workshopTitle),
  createdAt: r.p.createdAt.toISOString(), updatedAt: r.p.updatedAt.toISOString(),
});

export type ProductInput = Omit<Product, 'id' | 'seller' | 'instagram' | 'youtube' | 'phone' | 'email'> & { pickupLocation?: string };
/** undefined → null so that UPDATE really clears a field (Drizzle ignores undefined keys). */
export const toProductRow = (p: ProductInput) => ({
  name: p.name, category: p.category, city: p.city, pricePaise: p.pricePaise, description: p.description,
  stock: p.stock, status: p.status, imageUrl: p.imageUrl ?? null, workshopId: p.workshopId ?? null,
  pickupLocation: p.pickupLocation ?? null,
});

// ---------- workshops (starts_at <-> the API's date + time strings, India time) ----------
const IST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function istParts(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(IST_PARTS.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export const istToDate = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);

export const workshopSelect = {
  w: workshops,
  cityName: cities.name,
  citySlug: cities.slug,
  cityState: cities.state,
};
export type WorkshopJoinRow = { w: WorkshopRow; cityName: string; citySlug: string; cityState: string | null };
/** SELECT workshops + their city. Add .where(...) / .orderBy(...) / .for('update', { of: workshops }) as needed. */
export const workshopsQuery = (q: Q) =>
  q.select(workshopSelect).from(workshops).innerJoin(cities, eq(cities.id, workshops.cityId));

export const toWorkshop = (r: WorkshopJoinRow): Workshop => ({
  id: r.w.id, title: r.w.title, type: r.w.type as Workshop['type'], pricePaise: r.w.pricePaise,
  city: r.cityName, cityId: r.w.cityId, citySlug: r.citySlug, ...opt('cityState', r.cityState),
  venue: r.w.venue, ...istParts(r.w.startsAt), seats: r.w.seats, booked: r.w.booked, host: r.w.hostName,
  description: r.w.description, status: r.w.status,
});
/** Admin responses also carry the host's user id; the public API never does. */
export const toAdminWorkshop = (r: WorkshopJoinRow): Workshop => ({ ...toWorkshop(r), ...opt('hostId', r.w.hostId) });

export const toWorkshopRow = (w: Omit<Workshop, 'id' | 'booked' | 'hostId'>) => ({
  title: w.title, type: w.type, pricePaise: w.pricePaise, city: w.city, venue: w.venue,
  startsAt: istToDate(w.date, w.time), seats: w.seats, hostName: w.host, description: w.description, status: w.status,
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
