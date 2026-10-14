import { handle, json } from '@/lib/api';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  const db = await readDb();
  return json({ products: db.products.length, workshops: db.workshops.length, orders: db.orders.length, bookings: db.bookings.length, note: 'Local demo summary; admin authentication is not implemented.' });
});
