import crypto from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toBooking, toOrder } from '../db/mappers';
import { bookings as bookingsT, orderItems as orderItemsT, orders as ordersT, products as productsT, workshops as workshopsT } from '../db/schema';
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
    // Lock the involved products in a fixed order (id) so concurrent orders serialise instead of deadlocking.
    const rows = wanted.length
      ? await tx.select().from(productsT)
          .where(and(inArray(productsT.id, wanted), eq(productsT.status, 'APPROVED')))
          .orderBy(asc(productsT.id)).for('update')
      : [];
    const byId = new Map(rows.map(r => [r.id, r]));

    const items = reqItems.map(i => {
      const p = typeof i.productId === 'string' ? byId.get(i.productId) : undefined;
      const qty = Number(i.quantity);
      if (!p || !Number.isInteger(qty) || qty < 1 || qty > p.stock) throw new ApiError(400, STOCK_ERROR);
      return { productId: p.id, name: p.name, seller: p.seller, quantity: qty, unitPricePaise: p.pricePaise, lineTotalPaise: p.pricePaise * qty };
    });
    // same product listed twice: re-check the combined quantity
    const totals = new Map<string, number>();
    for (const it of items) totals.set(it.productId, (totals.get(it.productId) ?? 0) + it.quantity);
    for (const [id, qty] of totals) if (qty > byId.get(id)!.stock) throw new ApiError(400, STOCK_ERROR);

    const [orderRow] = await tx.insert(ordersT).values({
      id: crypto.randomUUID(),
      userEmail,
      customerName: str(b.customerName, 'Demo Customer', 100),
      email: String(b.email ?? '').slice(0, 200),
      totalPaise: items.reduce((s, i) => s + i.lineTotalPaise, 0),
      status: 'DEMO_ORDER_CREATED',
      note: 'Demo only: no payment has been collected.',
    }).returning();
    const itemRows = await tx.insert(orderItemsT).values(items.map(i => ({ orderId: orderRow.id, ...i }))).returning();
    for (const [id, qty] of totals)
      await tx.update(productsT).set({ stock: sql`${productsT.stock} - ${qty}` }).where(eq(productsT.id, id));
    return toOrder(orderRow, itemRows);
  });
}

export async function createBooking(input: unknown, userEmail: string): Promise<Booking> {
  const b = (input ?? {}) as Raw;
  const qty = Number(b.quantity ?? 1);
  const workshopId = typeof b.workshopId === 'string' ? b.workshopId : '';

  return getDb().transaction(async tx => {
    const [w] = await tx.select().from(workshopsT)
      .where(and(eq(workshopsT.id, workshopId), eq(workshopsT.status, 'APPROVED'))).for('update');
    if (!w) throw new ApiError(404, 'Workshop not found.');
    if (!Number.isInteger(qty) || qty < 1 || qty > w.seats - w.booked) throw new ApiError(409, 'Not enough seats remaining.');
    const free = w.type === 'FREE';
    const [row] = await tx.insert(bookingsT).values({
      id: crypto.randomUUID(),
      userEmail,
      workshopId: w.id,
      title: w.title,
      attendeeName: str(b.attendeeName, 'Demo Guest', 100),
      email: String(b.email ?? '').slice(0, 200),
      quantity: qty,
      totalPaise: w.pricePaise * qty,
      status: free ? 'CONFIRMED_FREE_DEMO' : 'DEMO_BOOKING_CREATED',
      note: free ? 'Free demo booking confirmed; no payment required.' : 'Demo only: no payment has been collected.',
    }).returning();
    await tx.update(workshopsT).set({ booked: sql`${workshopsT.booked} + ${qty}` }).where(eq(workshopsT.id, w.id));
    return toBooking(row);
  });
}

const ownerFilter = (u: SessionUser, col: typeof ordersT.userEmail | typeof bookingsT.userEmail) =>
  u.role === 'admin' ? undefined : sql`lower(${col}) = ${u.email.toLowerCase()}`;

export async function listOrders(u: SessionUser): Promise<Order[]> {
  const db = getDb();
  const rows = await db.select().from(ordersT).where(ownerFilter(u, ordersT.userEmail)).orderBy(asc(ordersT.createdAt), asc(ordersT.id));
  if (!rows.length) return [];
  const items = await db.select().from(orderItemsT).where(inArray(orderItemsT.orderId, rows.map(r => r.id))).orderBy(asc(orderItemsT.id));
  return rows.map(r => toOrder(r, items.filter(i => i.orderId === r.id)));
}

export async function listBookings(u: SessionUser): Promise<Booking[]> {
  const rows = await getDb().select().from(bookingsT).where(ownerFilter(u, bookingsT.userEmail)).orderBy(asc(bookingsT.createdAt), asc(bookingsT.id));
  return rows.map(toBooking);
}
