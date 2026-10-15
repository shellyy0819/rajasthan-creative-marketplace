import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  city: text('city').notNull(),
  pricePaise: integer('price_paise').notNull(),
  seller: text('seller').notNull(),
  description: text('description').notNull(),
  stock: integer('stock').notNull(),
  status: text('status').notNull().default('APPROVED'),
  artistName: text('artist_name'),
  instagram: text('instagram'),
  youtube: text('youtube'),
  phone: text('phone'),
  email: text('email'),
  imageUrl: text('image_url'),
}, t => [
  check('products_stock_nonneg', sql`${t.stock} >= 0`),
  check('products_price_nonneg', sql`${t.pricePaise} >= 0`),
  check('products_status_valid', sql`${t.status} in ('APPROVED', 'DRAFT')`),
  index('products_status_idx').on(t.status),
]);

export const workshops = pgTable('workshops', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  pricePaise: integer('price_paise').notNull(),
  city: text('city').notNull(),
  venue: text('venue').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  seats: integer('seats').notNull(),
  booked: integer('booked').notNull().default(0),
  host: text('host').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('APPROVED'),
}, t => [
  check('workshops_type_valid', sql`${t.type} in ('FREE', 'PAID')`),
  check('workshops_price_nonneg', sql`${t.pricePaise} >= 0`),
  check('workshops_seats_positive', sql`${t.seats} >= 1`),
  check('workshops_booked_range', sql`${t.booked} >= 0 and ${t.booked} <= ${t.seats}`),
  check('workshops_status_valid', sql`${t.status} in ('APPROVED', 'DRAFT')`),
  index('workshops_status_idx').on(t.status),
]);

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  userEmail: text('user_email').notNull(),
  customerName: text('customer_name').notNull(),
  email: text('email').notNull(),
  totalPaise: bigint('total_paise', { mode: 'number' }).notNull(),
  status: text('status').notNull(),
  note: text('note').notNull(),
});

// product_id is intentionally NOT a foreign key: order history must survive deleting a product.
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  name: text('name').notNull(),
  seller: text('seller').notNull(),
  quantity: integer('quantity').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  lineTotalPaise: bigint('line_total_paise', { mode: 'number' }).notNull(),
}, t => [
  check('order_items_quantity_positive', sql`${t.quantity} >= 1`),
  index('order_items_order_idx').on(t.orderId),
]);

// workshop_id is intentionally NOT a foreign key (same reason).
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  userEmail: text('user_email').notNull(),
  workshopId: text('workshop_id').notNull(),
  title: text('title').notNull(),
  attendeeName: text('attendee_name').notNull(),
  email: text('email').notNull(),
  quantity: integer('quantity').notNull(),
  totalPaise: bigint('total_paise', { mode: 'number' }).notNull(),
  status: text('status').notNull(),
  note: text('note').notNull(),
}, t => [check('bookings_quantity_positive', sql`${t.quantity} >= 1`)]);

// Persisted id counters so a deleted highest id is never handed out again.
export const idCounters = pgTable('id_counters', {
  prefix: text('prefix').primaryKey(),
  value: integer('value').notNull(),
});
