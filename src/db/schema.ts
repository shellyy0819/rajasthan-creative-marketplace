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
  website: text('website'),
  category: text('category'),
  logoUrl: text('logo_url'),
  whatsapp: text('whatsapp'),
  contactMethods: text('contact_methods').array().notNull().default(sql`'{}'::text[]`),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true, mode: 'date' }),
}, t => [index('seller_profiles_city_idx').on(t.cityId)]);

/** Product categories. Anyone who can create products may add one; names are unique ignoring case. */
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [uniqueIndex('categories_name_lower_idx').on(sql`lower(${t.name})`)]);

/**
 * Admin-managed ways a product came to be listed (Handmade, Curated, Resold, ...). `countsAsHandmade` is the only thing that lets the
 * site call a product "handmade"; `showBadge` decides whether its cards carry a label. Types in use are deactivated, never deleted.
 */
export const sourcingTypes = pgTable('sourcing_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  countsAsHandmade: boolean('counts_as_handmade').notNull().default(false),
  showBadge: boolean('show_badge').notNull().default(true),
  position: integer('position').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [uniqueIndex('sourcing_types_name_lower_idx').on(sql`lower(${t.name})`)]);

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull().references(() => categories.name, { onUpdate: 'cascade', onDelete: 'restrict' }),
  cityId: integer('city_id').notNull().references(() => cities.id, { onDelete: 'restrict' }),
  // The app always sends an explicit id; the default (1 = the seeded Handmade row) only covers legacy raw inserts.
  sourcingTypeId: integer('sourcing_type_id').notNull().default(1).references(() => sourcingTypes.id, { onDelete: 'restrict' }),
  pricePaise: integer('price_paise'),
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
  check('products_price_nonneg', sql`${t.pricePaise} is null or ${t.pricePaise} >= 0`),
  check('products_status_valid', sql`${t.status} in ('APPROVED', 'DRAFT', 'ARCHIVED')`),
  index('products_status_idx').on(t.status),
  index('products_seller_idx').on(t.sellerId),
  index('products_workshop_idx').on(t.workshopId),
  index('products_city_idx').on(t.cityId),
  index('products_sourcing_idx').on(t.sourcingTypeId),
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
  check('product_events_type_valid', sql`${t.type} in ('view', 'contact', 'artist', 'contact_call', 'contact_email', 'contact_instagram', 'contact_youtube', 'contact_copy')`),
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

/** "Host a workshop" submissions from the public form. An admin reads them and, if it fits, creates the workshop. */
export const workshopRequests = pgTable('workshop_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostName: text('host_name').notNull(),
  contactName: text('contact_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  city: text('city').notNull(),
  venue: text('venue').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  description: text('description').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(), // the form leaves it blank for a one-day event; the server then stores the start date
  startTime: text('start_time'), // 'HH:MM', optional
  endTime: text('end_time'),
  seats: integer('seats'),
  priceType: text('price_type').notNull(),
  pricePaise: integer('price_paise'),
  instagram: text('instagram'),
  website: text('website'),
  notes: text('notes'),
  images: jsonb('images').$type<string[]>().notNull().default(sql`'[]'::jsonb`), // up to 3 public photo urls, first is the cover
  status: text('status').notNull().default('unverified'), // 'received' once the emailed code is confirmed
  codeHash: text('code_hash'),
  codeExpiresAt: timestamp('code_expires_at', { withTimezone: true, mode: 'date' }),
  codeAttempts: integer('code_attempts').notNull().default(0),
  codeSends: integer('code_sends').notNull().default(0),
  codeSentAt: timestamp('code_sent_at', { withTimezone: true, mode: 'date' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('workshop_requests_kind_valid', sql`${t.kind} in ('workshop', 'meetup', 'popup', 'market')`),
  check('workshop_requests_price_type_valid', sql`${t.priceType} in ('FREE', 'PAID')`),
  check('workshop_requests_dates_ordered', sql`${t.endDate} >= ${t.startDate}`),
  check('workshop_requests_seats_positive', sql`${t.seats} is null or ${t.seats} >= 1`),
  check('workshop_requests_price_nonneg', sql`${t.pricePaise} is null or ${t.pricePaise} >= 0`),
  check('workshop_requests_status_valid', sql`${t.status} in ('unverified', 'received')`),
  index('workshop_requests_status_idx').on(t.status),
  index('workshop_requests_created_idx').on(t.createdAt),
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

/** Admin-editable settings, one row per area (key 'email' today). Secrets inside `value` are encrypted by the settings library, never stored in plain text. */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

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

/**
 * Who is walking around the exhibition (/fair) right now. One row per visitor code, refreshed by a heartbeat every few seconds and
 * deleted when stale. Holds no personal data: a random code, a position on the fair floor and the last emote.
 */
export const fairVisitors = pgTable('fair_visitors', {
  code: text('code').primaryKey(),
  x: doublePrecision('x').notNull(),
  y: doublePrecision('y').notNull(),
  facing: text('facing').notNull().default('down'),
  /** One of the ten looks (f1 to m5); null means the look the code starts with. */
  look: text('look'),
  emote: text('emote'),
  emoteSeq: integer('emote_seq').notNull().default(0),
  seenAt: timestamp('seen_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('fair_visitors_facing_valid', sql`${t.facing} in ('up', 'down', 'left', 'right')`),
  index('fair_visitors_seen_idx').on(t.seenAt),
]);

/**
 * Who owns which exhibition code. The first visitor to use a code owns it; only the browser that holds the matching secret can keep using it.
 * Only a hash of the secret is stored. A code that has not been used for 30 days is released.
 */
export const fairCodes = pgTable('fair_codes', {
  code: text('code').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  seenAt: timestamp('seen_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [index('fair_codes_seen_idx').on(t.seenAt)]);

/** Feedback notes left at the exhibition's mirror, for admins to read. `code` is the visitor's random code, not a person; `source` says whether the fair showed real or sample makers at the time. */
export const fairNotes = pgTable('fair_notes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  stall: text('stall').notNull(),
  text: text('text').notNull(),
  rating: smallint('rating').notNull().default(0),
  source: text('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [
  check('fair_notes_rating_valid', sql`${t.rating} between 0 and 5`),
  check('fair_notes_text_length', sql`char_length(${t.text}) between 1 and 280`),
  check('fair_notes_source_valid', sql`${t.source} in ('real', 'sample')`),
  index('fair_notes_created_idx').on(t.createdAt),
]);

/**
 * A visitor code's quests for one day, so progress survives clearing the browser and can be looked back on any day.
 * `quests` is a snapshot of the three quests offered that day (their wording can change later); `progress` holds what was done for each.
 */
export const fairQuestDays = pgTable('fair_quest_days', {
  code: text('code').notNull(),
  day: text('day').notNull(),
  quests: jsonb('quests').notNull(),
  progress: jsonb('progress').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.code, t.day] })]);
