import crypto from 'node:crypto';
import { mutateDb } from './db';
import { ApiError } from './errors';
import type { Booking, Order } from './types';

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback: string, max: number) => String(v ?? fallback).slice(0, max) || fallback;

export async function createOrder(input: unknown): Promise<Order> {
  const b = (input ?? {}) as Raw;
  if (!Array.isArray(b.items) || !b.items.length) throw new ApiError(400, 'Add at least one item.');
  if (b.items.some(i => !i || typeof i !== 'object' || Array.isArray(i)))
    throw new ApiError(400, 'A product is unavailable or quantity exceeds stock.');
  const reqItems = b.items as Raw[];
  return mutateDb(db => {
    const items = reqItems.map(i => {
      const p = db.products.find(p => p.id === i.productId && p.status === 'APPROVED');
      const qty = Number(i.quantity);
      if (!p || !Number.isInteger(qty) || qty < 1 || qty > p.stock)
        throw new ApiError(400, 'A product is unavailable or quantity exceeds stock.');
      return { productId: p.id, name: p.name, seller: p.seller, quantity: qty, unitPricePaise: p.pricePaise, lineTotalPaise: p.pricePaise * qty };
    });
    // same product listed twice: re-check combined quantity
    const totals = new Map<string, number>();
    for (const it of items) totals.set(it.productId, (totals.get(it.productId) ?? 0) + it.quantity);
    for (const [id, qty] of totals)
      if (qty > db.products.find(p => p.id === id)!.stock)
        throw new ApiError(400, 'A product is unavailable or quantity exceeds stock.');
    const order: Order = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      customerName: str(b.customerName, 'Demo Customer', 100),
      email: String(b.email ?? '').slice(0, 200),
      items,
      totalPaise: items.reduce((s, i) => s + i.lineTotalPaise, 0),
      status: 'DEMO_ORDER_CREATED',
      note: 'Demo only: no payment has been collected.',
    };
    for (const [id, qty] of totals) db.products.find(p => p.id === id)!.stock -= qty;
    db.orders.push(order);
    return order;
  });
}

export async function createBooking(input: unknown): Promise<Booking> {
  const b = (input ?? {}) as Raw;
  const qty = Number(b.quantity ?? 1);
  return mutateDb(db => {
    const w = db.workshops.find(w => w.id === b.workshopId && w.status === 'APPROVED');
    if (!w) throw new ApiError(404, 'Workshop not found.');
    if (!Number.isInteger(qty) || qty < 1 || qty > w.seats - w.booked)
      throw new ApiError(409, 'Not enough seats remaining.');
    const free = w.type === 'FREE';
    const booking: Booking = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      workshopId: w.id,
      title: w.title,
      attendeeName: str(b.attendeeName, 'Demo Guest', 100),
      email: String(b.email ?? '').slice(0, 200),
      quantity: qty,
      totalPaise: w.pricePaise * qty,
      status: free ? 'CONFIRMED_FREE_DEMO' : 'DEMO_BOOKING_CREATED',
      note: free ? 'Free demo booking confirmed; no payment required.' : 'Demo only: no payment has been collected.',
    };
    w.booked += qty;
    db.bookings.push(booking);
    return booking;
  });
}
