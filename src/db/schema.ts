import { sql } from 'drizzle-orm';
import { type AnyPgColumn, bigint, bigserial, boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: smallint('id').primaryKey(),
  name: text('name').notNull().unique(),
});

/** Cities where artists, products and workshops are located. Rows come from OpenStreetMap (osm_*) or the launch seed. */
export const cities = pgTable('cities', {
  id: serial('id').primaryKey(),
  osmType: text('osm_type'),
  osmId: bigint('osm_id', { mode: 'number' }),
  name: text('name').notNull(),
  state: text('state'),
  slug: text('slug').notNull().unique(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [uniqueIndex('cities_osm_idx').on(t.osmType, t.osmId)]);
export type CityRow = typeof cities.$inferSelect;

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  googleSub: text('google_sub').unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  cityId: integer('city_id').references(() => cities.id, { onDelete: 'set null' }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`), index('users_city_idx').on(t.cityId)]);

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
  bio: text('bio'),
  cityId: integer('city_id').references(() => cities.id, { onDelete: 'set null' }),
}, t => [index('seller_profiles_city_idx').on(t.cityId)]);

/** Product categories. Anyone who can create products may add one; names are unique ignoring case. */
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [uniqueIndex('categories_name_lower_idx').on(sql`lower(${t.name})`)]);

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull().references(() => categories.name, { onUpdate: 'cascade', onDelete: 'restrict' }),
  cityId: integer('city_id').notNull().references(() => cities.id, { onDelete: 'restrict' }),
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
  index('products_city_idx').on(t.cityId),
]);

export const workshops = pgTable('workshops', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  pricePaise: integer('price_paise').notNull(),
  cityId: integer('city_id').notNull().references(() => cities.id, { onDelete: 'restrict' }),
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
  index('workshops_city_idx').on(t.cityId),
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

export const productLikes = pgTable('product_likes', {
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.productId, t.actor] }), index('product_likes_created_idx').on(t.createdAt)]);

export const productEvents = pgTable('product_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  actor: text('actor').notNull(),
  day: date('day', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('product_events_type_valid', sql`${t.type} in ('view', 'contact', 'artist')`),
  uniqueIndex('product_events_unique_idx').on(t.productId, t.type, t.actor, t.day),
  index('product_events_day_idx').on(t.day),
]);

/** People who want to sell on the marketplace (public form). Phone is format-checked, not verified: an admin calls, then confirms. */
export const listingRequests = pgTable('listing_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerName: text('owner_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  instagram: text('instagram'),
  website: text('website'),
  businessName: text('business_name').notNull(),
  size: text('size').notNull(),
  status: text('status').notNull().default('received'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
  confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('listing_requests_size_valid', sql`${t.size} in ('small', 'medium', 'large')`),
  check('listing_requests_status_valid', sql`${t.status} in ('received', 'confirmed')`),
  index('listing_requests_created_idx').on(t.createdAt),
  index('listing_requests_status_idx').on(t.status),
]);

/** Ordered photos of a product; position 0 is the cover. `s3Key` is null for legacy links that live on other hosts. */
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  s3Key: text('s3_key'),
  position: smallint('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [uniqueIndex('product_images_product_position_idx').on(t.productId, t.position)]);

/** Admin-scheduled festive themes. At most one row has status 'base' (the editable Everyday wording). */
export const siteThemes = pgTable('site_themes', {
  id: serial('id').primaryKey(),
  preset: text('preset').notNull(),
  status: text('status').notNull().default('draft'),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }),
  config: jsonb('config').notNull(),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('site_themes_status_valid', sql`${t.status} in ('draft', 'scheduled', 'base')`),
  check('site_themes_window_order', sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} > ${t.startsAt}`),
  check('site_themes_scheduled_dates', sql`${t.status} <> 'scheduled' or (${t.startsAt} is not null and ${t.endsAt} is not null)`),
  uniqueIndex('site_themes_one_base_idx').on(t.status).where(sql`${t.status} = 'base'`),
  index('site_themes_window_idx').on(t.startsAt),
]);
export type SiteThemeRow = typeof siteThemes.$inferSelect;
