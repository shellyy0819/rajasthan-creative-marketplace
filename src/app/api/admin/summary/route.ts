import { auth } from '@/auth';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  const db = await readDb();
  return json({ products: db.products.length, workshops: db.workshops.length, orders: db.orders.length, bookings: db.bookings.length, note: 'Demo summary; admin-only.' });
});
