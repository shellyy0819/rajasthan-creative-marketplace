import { sql } from 'drizzle-orm';
import { type AnyPgColumn, bigint, boolean, check, index, integer, pgTable, primaryKey, serial, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: smallint('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  googleSub: text('google_sub').unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  city: text('city'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`)]);

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: smallint('role_id').notNull().references(() => roles.id, { onDelete: 'restrict' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.roleId] }), index('user_roles_role_idx').on(t.roleId)]);

export const sellerProfiles = pgTable('seller_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  publicPhone: text('public_phone'),
  publicEmail: text('public_email'),
  instagram: text('instagram'),
  youtube: text('youtube'),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  city: text('city').notNull(),
  pricePaise: integer('price_paise').notNull(),
  description: text('description').notNull(),
  stock: integer('stock').notNull(),
  status: text('status').notNull().default('APPROVED'),
  imageUrl: text('image_url'),
  sellerId: uuid('seller_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  workshopId: text('workshop_id').references((): AnyPgColumn => workshops.id, { onDelete: 'set null' }),
  pickupLocation: text('pickup_location'),
  publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('products_stock_nonneg', sql`${t.stock} >= 0`),
  check('products_price_nonneg', sql`${t.pricePaise} >= 0`),
  check('products_status_valid', sql`${t.status} in ('APPROVED', 'DRAFT', 'ARCHIVED')`),
  index('products_status_idx').on(t.status),
  index('products_seller_idx').on(t.sellerId),
  index('products_workshop_idx').on(t.workshopId),
]);

export const workshops = pgTable('workshops', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  pricePaise: integer('price_paise').notNull(),
  city: text('city').notNull(),
  venue: text('venue').notNull(),
  seats: integer('seats').notNull(),
  booked: integer('booked').notNull().default(0),
  description: text('description').notNull(),
  status: text('status').notNull().default('APPROVED'),
  hostId: uuid('host_id').references(() => users.id, { onDelete: 'restrict' }),
  hostName: text('host_name').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('workshops_type_valid', sql`${t.type} in ('FREE', 'PAID')`),
  check('workshops_price_nonneg', sql`${t.pricePaise} >= 0`),
  check('workshops_seats_positive', sql`${t.seats} >= 1`),
  check('workshops_booked_range', sql`${t.booked} >= 0 and ${t.booked} <= ${t.seats}`),
  check('workshops_status_valid', sql`${t.status} in ('APPROVED', 'DRAFT', 'ARCHIVED')`),
  index('workshops_status_idx').on(t.status),
  index('workshops_host_idx').on(t.hostId),
  index('workshops_starts_idx').on(t.startsAt),
]);

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
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
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
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
