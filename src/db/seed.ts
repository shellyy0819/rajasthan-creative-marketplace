import { sql } from 'drizzle-orm';
import type { Booking, Order, Product, Workshop } from '../lib/types';
import type { Database } from './client';
import { toProductRow, toWorkshopRow } from './mappers';
import { bookings, idCounters, orderItems, orders, products, workshops } from './schema';

/** Shape of data/db.json (the old JSON-file store). */
export type LegacyDb = {
  products: Product[]; workshops: Workshop[]; orders: Order[]; bookings: Booking[];
  counters?: { p?: number; w?: number };
};

export async function truncateAll(db: Database): Promise<void> {
  await db.execute(sql`truncate table order_items, orders, bookings, products, workshops, id_counters restart identity cascade`);
}

const maxNumericId = (prefix: string, ids: string[]) =>
  ids.reduce((m, id) => Math.max(m, Number(new RegExp(`^${prefix}(\\d+)$`).exec(id)?.[1] ?? 0)), 0);

/** Idempotent: existing ids are left untouched. Returns how many rows were actually inserted. */
export async function seedFromJson(db: Database, data: LegacyDb) {
  return db.transaction(async tx => {
    const inserted = { products: 0, workshops: 0, orders: 0, bookings: 0 };

    for (const p of data.products ?? []) {
      const r = await tx.insert(products).values({ id: p.id, ...toProductRow(p) }).onConflictDoNothing().returning({ id: products.id });
      inserted.products += r.length;
    }
    for (const w of data.workshops ?? []) {
      const r = await tx.insert(workshops).values({ id: w.id, ...toWorkshopRow(w), booked: w.booked }).onConflictDoNothing().returning({ id: workshops.id });
      inserted.workshops += r.length;
    }
    for (const o of data.orders ?? []) {
      const r = await tx.insert(orders).values({
        id: o.id, createdAt: new Date(o.createdAt), userEmail: o.userEmail ?? '', customerName: o.customerName,
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
      const r = await tx.insert(bookings).values({
        id: b.id, createdAt: new Date(b.createdAt), userEmail: b.userEmail ?? '', workshopId: b.workshopId,
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
