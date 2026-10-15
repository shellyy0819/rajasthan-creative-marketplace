import { count } from 'drizzle-orm';
import { auth } from '@/auth';
import { getDb } from '@/db/client';
import { bookings, orders, products, workshops } from '@/db/schema';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '@/lib/authz';
export const dynamic = 'force-dynamic';
export const GET = () => handle(async () => {
  requireAdmin(await auth());
  const db = getDb();
  const [[p], [w], [o], [b]] = await Promise.all([
    db.select({ n: count() }).from(products), db.select({ n: count() }).from(workshops),
    db.select({ n: count() }).from(orders), db.select({ n: count() }).from(bookings),
  ]);
  return json({ products: p.n, workshops: w.n, orders: o.n, bookings: b.n, note: 'Demo summary; admin-only.' });
});
