import crypto from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toBooking, toOrder } from '../db/mappers';
import { ensureUser } from '../db/people';
import { bookings as bookingsT, orderItems as orderItemsT, orders as ordersT, products as productsT, users, workshops as workshopsT } from '../db/schema';
import type { SessionUser } from './authz';
import { ApiError } from './errors';
import type { Booking, Order } from './types';

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback: string, max: number) => String(v ?? fallback).slice(0, max) || fallback;
const STOCK_ERROR = 'A product is unavailable or quantity exceeds stock.';

export async function createOrder(input: unknown, userEmail: string): Promise<Order> {
  const b = (input ?? {}) as Raw;
  if (!Array.isArray(b.items) || !b.items.length) throw new ApiError(400, 'Add at least one item.');
  if (b.items.some(i => !i || typeof i !== 'object' || Array.isArray(i))) throw new ApiError(400, STOCK_ERROR);
  const reqItems = b.items as Raw[];
  const wanted = [...new Set(reqItems.map(i => (typeof i.productId === 'string' ? i.productId : '')).filter(Boolean))];

  return getDb().transaction(async tx => {
    const buyer = await ensureUser(tx, userEmail);
    // Lock the involved products (not the seller rows) in a fixed order (id) so concurrent orders serialise instead of deadlocking.
    const rows = wanted.length
      ? await productsQuery(tx)
          .where(and(inArray(productsT.id, wanted), eq(productsT.status, 'APPROVED')))
          .orderBy(asc(productsT.id)).for('update', { of: productsT })
      : [];
    const byId = new Map(rows.map(r => [r.p.id, r]));

    const items = reqItems.map(i => {
      const r = typeof i.productId === 'string' ? byId.get(i.productId) : undefined;
      const qty = Number(i.quantity);
      if (!r || !Number.isInteger(qty) || qty < 1 || qty > r.p.stock) throw new ApiError(400, STOCK_ERROR);
      return { productId: r.p.id, name: r.p.name, seller: r.sellerName, quantity: qty, unitPricePaise: r.p.pricePaise, lineTotalPaise: r.p.pricePaise * qty };
    });
    // same product listed twice: re-check the combined quantity
    const totals = new Map<string, number>();
    for (const it of items) totals.set(it.productId, (totals.get(it.productId) ?? 0) + it.quantity);
    for (const [id, qty] of totals) if (qty > byId.get(id)!.p.stock) throw new ApiError(400, STOCK_ERROR);

    const [orderRow] = await tx.insert(ordersT).values({
      id: crypto.randomUUID(),
      userId: buyer.id,
      customerName: str(b.customerName, 'Customer', 100),
      email: String(b.email ?? '').slice(0, 200),
      totalPaise: items.reduce((s, i) => s + i.lineTotalPaise, 0),
      status: 'DEMO_ORDER_CREATED',
      note: 'No payment has been collected.',
    }).returning();
    const itemRows = await tx.insert(orderItemsT).values(items.map(i => ({ orderId: orderRow.id, ...i }))).returning();
    for (const [id, qty] of totals)
      await tx.update(productsT).set({ stock: sql`${productsT.stock} - ${qty}`, updatedAt: new Date() }).where(eq(productsT.id, id));
    return toOrder(orderRow, buyer.email, itemRows);
  });
}

export async function createBooking(input: unknown, userEmail: string): Promise<Booking> {
  const b = (input ?? {}) as Raw;
  const qty = Number(b.quantity ?? 1);
  const workshopId = typeof b.workshopId === 'string' ? b.workshopId : '';

  return getDb().transaction(async tx => {
    const guest = await ensureUser(tx, userEmail);
    const [w] = await tx.select().from(workshopsT)
      .where(and(eq(workshopsT.id, workshopId), eq(workshopsT.status, 'APPROVED'))).for('update');
    if (!w) throw new ApiError(404, 'Workshop not found.');
    if (!Number.isInteger(qty) || qty < 1 || qty > w.seats - w.booked) throw new ApiError(409, 'Not enough seats remaining.');
    const free = w.type === 'FREE';
    const [row] = await tx.insert(bookingsT).values({
      id: crypto.randomUUID(),
      userId: guest.id,
      workshopId: w.id,
      title: w.title,
      attendeeName: str(b.attendeeName, 'Guest', 100),
      email: String(b.email ?? '').slice(0, 200),
      quantity: qty,
      totalPaise: w.pricePaise * qty,
      status: free ? 'CONFIRMED_FREE_DEMO' : 'DEMO_BOOKING_CREATED',
      note: free ? 'Free booking confirmed; no payment required.' : 'No payment has been collected.',
    }).returning();
    await tx.update(workshopsT).set({ booked: sql`${workshopsT.booked} + ${qty}`, updatedAt: new Date() }).where(eq(workshopsT.id, w.id));
    return toBooking(row, guest.email);
  });
}

const ownedBy = (u: SessionUser) => (u.role === 'admin' ? undefined : sql`lower(${users.email}) = ${u.email.toLowerCase()}`);

export async function listOrders(u: SessionUser): Promise<Order[]> {
  const db = getDb();
  const rows = await db.select({ o: ordersT, email: users.email }).from(ordersT)
    .innerJoin(users, eq(users.id, ordersT.userId)).where(ownedBy(u)).orderBy(asc(ordersT.createdAt), asc(ordersT.id));
  if (!rows.length) return [];
  const items = await db.select().from(orderItemsT).where(inArray(orderItemsT.orderId, rows.map(r => r.o.id))).orderBy(asc(orderItemsT.id));
  return rows.map(r => toOrder(r.o, r.email, items.filter(i => i.orderId === r.o.id)));
}

export async function listBookings(u: SessionUser): Promise<Booking[]> {
  const rows = await getDb().select({ b: bookingsT, email: users.email }).from(bookingsT)
    .innerJoin(users, eq(users.id, bookingsT.userId)).where(ownedBy(u)).orderBy(asc(bookingsT.createdAt), asc(bookingsT.id));
  return rows.map(r => toBooking(r.b, r.email));
}
