import { sql } from 'drizzle-orm';
import { artistKey } from '../lib/artist';
import type { Db as LegacyDb } from '../lib/types';
import type { Database } from './client';
import { ensureSellerProfile, ensureUser, grantRole } from './people';
import { istToDate, toProductRow } from './mappers';
import { ensureCityByName, LAUNCH_CITIES } from '../lib/cities';
import { bookings, categories, idCounters, orderItems, orders, products, sellerProfiles, workshops } from './schema';
import { DEFAULT_CATEGORIES } from '../lib/catalog-shared';

export type { LegacyDb };
const LEGACY_EMAIL = 'legacy@rangrajasthan.invalid';

export async function truncateAll(db: Database): Promise<void> {
  // cities is wiped too (the migration's launch cities included); seedFromJson recreates the ones it needs.
  // roles is reference data (seeded by a migration) and is deliberately kept.
  await db.execute(sql`truncate table order_items, orders, bookings, products, workshops, seller_profiles, user_roles, users, categories, cities, id_counters restart identity cascade`);
}

const maxNumericId = (prefix: string, ids: string[]) =>
  ids.reduce((m, id) => Math.max(m, Number(new RegExp(`^${prefix}(\\d+)$`).exec(id)?.[1] ?? 0)), 0);
const slug = (s: string) => artistKey(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seller';

/**
 * Import the old JSON shape. Idempotent: existing ids are left untouched. Each distinct seller name becomes a
 * seller user (<slug>@seed.rangrajasthan.invalid, no Google login) with a public profile built from the product contact fields.
 * Returns how many rows were actually inserted.
 */
export async function seedFromJson(db: Database, data: LegacyDb) {
  return db.transaction(async tx => {
    const inserted = { products: 0, workshops: 0, orders: 0, bookings: 0 };

    // categories: the starter four plus anything the imported products use (products reference categories by name)
    for (const name of new Set<string>([...DEFAULT_CATEGORIES, ...(data.products ?? []).map(p => p.category)]))
      await tx.insert(categories).values({ name }).onConflictDoNothing();

    const cityIds = new Map<string, number>(); // lower(name) -> cities.id
    const cityId = async (name: string) => {
      const key = name.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!cityIds.has(key)) {
        const launch = LAUNCH_CITIES.find(c => c.name.toLowerCase() === key);
        cityIds.set(key, (await ensureCityByName(tx, name, launch)).id);
      }
      return cityIds.get(key)!;
    };

    const sellers = new Map<string, string>(); // artistKey -> user id
    for (const p of data.products ?? []) {
      const key = artistKey(p.seller);
      if (sellers.has(key)) continue;
      const u = await ensureUser(tx, `${slug(p.seller)}@seed.rangrajasthan.invalid`, p.seller.trim());
      await grantRole(tx, u.id, 'seller');
      await ensureSellerProfile(tx, u.id, p.seller.replace(/\s+/g, ' ').trim());
      const contact = (data.products ?? []).find(x => artistKey(x.seller) === key && (x.phone || x.email || x.instagram || x.youtube)) ?? p;
      await tx.update(sellerProfiles).set({
        publicPhone: contact.phone ?? null, publicEmail: contact.email ?? null, instagram: contact.instagram ?? null, youtube: contact.youtube ?? null,
      }).where(sql`${sellerProfiles.userId} = ${u.id} and ${sellerProfiles.publicPhone} is null and ${sellerProfiles.publicEmail} is null and ${sellerProfiles.instagram} is null and ${sellerProfiles.youtube} is null`);
      sellers.set(key, u.id);
    }

    for (const p of data.products ?? []) {
      const { city, ...row } = toProductRow(p);
      const r = await tx.insert(products).values({ id: p.id, sellerId: sellers.get(artistKey(p.seller))!, ...row, cityId: await cityId(city) }).onConflictDoNothing().returning({ id: products.id });
      inserted.products += r.length;
    }
    for (const w of data.workshops ?? []) {
      const r = await tx.insert(workshops).values({
        id: w.id, title: w.title, type: w.type, pricePaise: w.pricePaise, cityId: await cityId(w.city), venue: w.venue,
        startsAt: istToDate(w.date, w.time), seats: w.seats, booked: w.booked, hostName: w.host,
        description: w.description, status: w.status,
      }).onConflictDoNothing().returning({ id: workshops.id });
      inserted.workshops += r.length;
    }
    for (const o of data.orders ?? []) {
      const u = await ensureUser(tx, o.userEmail || LEGACY_EMAIL, o.customerName);
      const r = await tx.insert(orders).values({
        id: o.id, createdAt: new Date(o.createdAt), userId: u.id, customerName: o.customerName,
        email: o.email, totalPaise: o.totalPaise, status: o.status, note: o.note,
      }).onConflictDoNothing().returning({ id: orders.id });
      if (!r.length) continue;
      inserted.orders++;
      if (o.items?.length) {
        await tx.insert(orderItems).values(o.items.map(i => ({
          orderId: o.id, productId: i.productId, name: i.name, seller: i.seller, quantity: i.quantity,
          unitPricePaise: i.unitPricePaise, lineTotalPaise: i.lineTotalPaise,
        })));
      }
    }
    for (const b of data.bookings ?? []) {
      const u = await ensureUser(tx, b.userEmail || LEGACY_EMAIL, b.attendeeName);
      const r = await tx.insert(bookings).values({
        id: b.id, createdAt: new Date(b.createdAt), userId: u.id, workshopId: b.workshopId,
        title: b.title, attendeeName: b.attendeeName, email: b.email, quantity: b.quantity,
        totalPaise: b.totalPaise, status: b.status, note: b.note,
      }).onConflictDoNothing().returning({ id: bookings.id });
      inserted.bookings += r.length;
    }

    for (const [prefix, ids] of [['p', (data.products ?? []).map(p => p.id)], ['w', (data.workshops ?? []).map(w => w.id)]] as const) {
      const value = Math.max(data.counters?.[prefix] ?? 0, maxNumericId(prefix, ids));
      await tx.insert(idCounters).values({ prefix, value })
        .onConflictDoUpdate({ target: idCounters.prefix, set: { value: sql`greatest(${idCounters.value}, ${value})` } });
    }
    return inserted;
  });
}
