import type { Booking, Order, OrderItem, Product, Workshop } from '../lib/types';
import type { bookings, orderItems, orders, products, workshops } from './schema';

type ProductRow = typeof products.$inferSelect;
type WorkshopRow = typeof workshops.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type BookingRow = typeof bookings.$inferSelect;

// Optional fields are omitted (never null) so API JSON stays identical to the old JSON-file store.
const opt = <K extends string>(key: K, v: string | null) => (v == null ? {} : { [key]: v }) as Partial<Record<K, string>>;

export const toProduct = (r: ProductRow): Product => ({
  id: r.id, name: r.name, category: r.category, city: r.city, pricePaise: r.pricePaise,
  seller: r.seller, description: r.description, stock: r.stock, status: r.status,
  ...opt('artistName', r.artistName), ...opt('instagram', r.instagram), ...opt('youtube', r.youtube),
  ...opt('phone', r.phone), ...opt('email', r.email), ...opt('imageUrl', r.imageUrl),
});

/** undefined → null so that UPDATE really clears a field (Drizzle ignores undefined keys). */
export const toProductRow = (p: Omit<Product, 'id'>) => ({
  name: p.name, category: p.category, city: p.city, pricePaise: p.pricePaise, seller: p.seller,
  description: p.description, stock: p.stock, status: p.status,
  artistName: p.artistName ?? null, instagram: p.instagram ?? null, youtube: p.youtube ?? null,
  phone: p.phone ?? null, email: p.email ?? null, imageUrl: p.imageUrl ?? null,
});

export const toWorkshop = (r: WorkshopRow): Workshop => ({
  id: r.id, title: r.title, type: r.type as Workshop['type'], pricePaise: r.pricePaise, city: r.city,
  venue: r.venue, date: r.date, time: r.time, seats: r.seats, booked: r.booked, host: r.host,
  description: r.description, status: r.status,
});

export const toWorkshopRow = (w: Omit<Workshop, 'id' | 'booked'>) => ({
  title: w.title, type: w.type, pricePaise: w.pricePaise, city: w.city, venue: w.venue,
  date: w.date, time: w.time, seats: w.seats, host: w.host, description: w.description, status: w.status,
});

const toItem = (i: OrderItemRow): OrderItem => ({
  productId: i.productId, name: i.name, seller: i.seller, quantity: i.quantity,
  unitPricePaise: i.unitPricePaise, lineTotalPaise: i.lineTotalPaise,
});

export const toOrder = (r: OrderRow, items: OrderItemRow[]): Order => ({
  id: r.id, createdAt: r.createdAt.toISOString(), userEmail: r.userEmail, customerName: r.customerName,
  email: r.email, items: items.map(toItem), totalPaise: r.totalPaise, status: r.status, note: r.note,
});

export const toBooking = (r: BookingRow): Booking => ({
  id: r.id, createdAt: r.createdAt.toISOString(), userEmail: r.userEmail, workshopId: r.workshopId,
  title: r.title, attendeeName: r.attendeeName, email: r.email, quantity: r.quantity,
  totalPaise: r.totalPaise, status: r.status, note: r.note,
});
