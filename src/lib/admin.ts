import { and, count, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client';
import { allocateId } from '../db/ids';
import { productsQuery, toAdminProduct, toProductRow, toWorkshop, toAdminWorkshop, toWorkshopRow, workshopsQuery, type ProductInput, type WorkshopInput } from '../db/mappers';
import { ROLE_ID, ensureUser } from '../db/people';
import { products as productsT, userRoles, users, workshops as workshopsT } from '../db/schema';
import type { Tx } from '../db/client';
import { resolveCityInput } from './cities';
import { canonicalCategory } from './categories';
import { resolveSourcingTypeId } from './sourcing-types';
import type { Actor } from './authz';
import { ApiError } from './errors';
import { bad, int, obj, oneOf, optionalInt, optionalText, optionalUuid, pick, text, validDate, type Raw } from './validate';
import { loadImages, parseImages, resolveImages, saveImages, unreferencedKeys } from './product-images';
import { deleteObjects, storageConfig } from './storage';
import type { AdminProduct, Workshop } from './types';

const PRODUCT_KEYS = ['name', 'category', 'sourcingTypeId', 'cityId', 'cityRef', 'pricePaise', 'description', 'stock', 'status', 'images', 'workshopId', 'pickupLocation'] as const;
const WORKSHOP_KEYS = ['title', 'type', 'pricePaise', 'cityId', 'cityRef', 'venue', 'date', 'time', 'seats', 'host', 'hostId', 'description', 'status'] as const;
const PRODUCT_STATUSES = ['APPROVED', 'DRAFT', 'ARCHIVED'] as const;
const WORKSHOP_STATUSES = ['APPROVED', 'DRAFT', 'ARCHIVED'] as const;
const PUBLISH_DENIED = () => new ApiError(403, 'Only an admin can publish a product.');

function optionalWorkshopId(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || !/^w\d+$/.test(v)) throw bad('workshopId must look like w1.');
  return v;
}

/** A free-text `city` is never accepted: cities come from a signed place-search ref or an existing id. */
function rejectFreeTextCity(input: Raw) {
  if ('city' in input) throw bad('city is not accepted; send cityId or cityRef.');
}

type ProductFields = Omit<ProductInput, 'cityId'>;
function validateProduct(v: Raw): ProductFields {
  return {
    name: text(v.name, 'name', 200),
    category: typeof v.category === 'string' ? v.category : '', // checked against the categories table inside the transaction
    sourcingTypeId: optionalInt(v.sourcingTypeId, 'sourcingTypeId', 0, 1_000_000) ?? 0, // 0 = not chosen; resolved against the sourcing_types table inside the transaction
    pricePaise: optionalInt(v.pricePaise, 'pricePaise', 0, 10_000_000),
    description: text(v.description, 'description', 2000),
    stock: int(v.stock, 'stock', 0, 100_000),
    status: oneOf(v.status ?? 'DRAFT', 'status', PRODUCT_STATUSES), // new posts start as drafts; only an explicit admin choice publishes
    workshopId: optionalWorkshopId(v.workshopId),
    pickupLocation: optionalText(v.pickupLocation, 'pickupLocation', 200),
  };
}

const inputOf = (p: typeof productsT.$inferSelect): ProductInput => ({
  name: p.name, category: p.category, cityId: p.cityId, sourcingTypeId: p.sourcingTypeId, pricePaise: p.pricePaise, description: p.description,
  stock: p.stock, status: p.status, workshopId: p.workshopId ?? undefined,
  pickupLocation: p.pickupLocation ?? undefined,
});
const contentOf = (p: ProductInput) => { const { status: _s, ...rest } = toProductRow(p); return JSON.stringify(rest); };

async function requireWorkshop(tx: Tx, id: string | undefined) {
  if (!id) return;
  const [w] = await tx.select({ id: workshopsT.id }).from(workshopsT).where(eq(workshopsT.id, id));
  if (!w) throw bad('workshopId does not match a workshop.');
}

/** The user must exist, be active, and hold the seller or admin role to own products. */
async function requireSellerUser(tx: Tx, id: string) {
  const [u] = await tx.select({ id: users.id, active: users.active }).from(users).where(eq(users.id, id));
  const roleRows = u ? await tx.select({ r: userRoles.roleId }).from(userRoles).where(and(eq(userRoles.userId, id), inArray(userRoles.roleId, [ROLE_ID.seller, ROLE_ID.admin]))) : [];
  if (!u || !u.active || !roleRows.length) throw bad('sellerId must be an active user with the seller role.');
}

async function loadAdminProduct(tx: Tx, id: string): Promise<AdminProduct> {
  const [row] = await productsQuery(tx).where(eq(productsT.id, id));
  return toAdminProduct(row);
}

/** Removes photos from S3 after the database change is committed. Best effort: a failure never fails the request. */
async function dropStoredPhotos(keys: string[]) {
  const cfg = storageConfig();
  if (!cfg || !keys.length) return;
  try { await deleteObjects(cfg, keys); } catch (e) { console.error('could not delete stored photos', (e as Error)?.name ?? 'error'); }
}

export async function createProduct(input: unknown, actor: Actor): Promise<AdminProduct> {
  rejectFreeTextCity(obj(input));
  const raw = pick(obj(input), [...PRODUCT_KEYS, 'sellerId']);
  const assigned = optionalUuid(raw.sellerId, 'sellerId');
  delete raw.sellerId;
  const seller = actor.role === 'seller';
  const data = validateProduct(raw);
  const imageUrls = parseImages(raw.images) ?? [];
  if (seller && data.status === 'APPROVED') throw PUBLISH_DENIED();
  return getDb().transaction(async tx => {
    const me = await ensureUser(tx, actor.email);
    let sellerId = me.id;
    if (seller) {
      if (assigned && assigned !== me.id) throw new ApiError(403, 'Only an admin can assign a seller.');
    } else if (assigned) {
      await requireSellerUser(tx, assigned);
      sellerId = assigned;
    }
    data.category = await canonicalCategory(tx, data.category);
    data.sourcingTypeId = await resolveSourcingTypeId(tx, data.sourcingTypeId);
    const cityId = (await resolveCityInput(tx, raw, { required: true }))!;
    await requireWorkshop(tx, data.workshopId);
    const id = await allocateId(tx, 'p');
    const published = data.status === 'APPROVED' ? { publishedBy: me.id, publishedAt: new Date() } : {};
    await tx.insert(productsT).values({ id, sellerId, ...toProductRow({ ...data, cityId }), ...published });
    await saveImages(tx, id, await resolveImages(tx, { urls: imageUrls, userId: me.id, isAdmin: !seller, cfg: storageConfig() }));
    return loadAdminProduct(tx, id);
  });
}

export async function updateProduct(id: string, input: unknown, actor: Actor): Promise<AdminProduct> {
  rejectFreeTextCity(obj(input));
  const raw = pick(obj(input), [...PRODUCT_KEYS, 'sellerId']);
  const assigned = optionalUuid(raw.sellerId, 'sellerId');
  delete raw.sellerId;
  const seller = actor.role === 'seller';
  const imageUrls = parseImages(raw.images);
  const { product, removedKeys } = await getDb().transaction(async tx => {
    const me = await ensureUser(tx, actor.email);
    const [row] = await tx.select().from(productsT).where(eq(productsT.id, id)).for('update');
    // A seller must not learn that someone else's product exists.
    if (!row || (seller && row.sellerId !== me.id)) throw new ApiError(404, 'Product not found.');
    if (seller && assigned && assigned !== me.id) throw new ApiError(403, 'Only an admin can assign a seller.');
    const current = inputOf(row);
    // An edit that sends neither cityId nor cityRef keeps the product's city; a cityRef wins over a cityId.
    const cityId = (await resolveCityInput(tx, { cityId: current.cityId, ...raw }, { required: true }))!;
    let next: ProductInput = { ...validateProduct({ ...current, ...raw }), cityId };
    const currentImages = await loadImages(tx, id);
    const nextImages = imageUrls === undefined ? currentImages : await resolveImages(tx, { urls: imageUrls, productId: id, userId: me.id, isAdmin: !seller, cfg: storageConfig() });
    const photosChanged = JSON.stringify(currentImages.map(r => r.url)) !== JSON.stringify(nextImages.map(r => r.url));
    if (seller) {
      if (row.status !== 'APPROVED' && next.status === 'APPROVED') throw PUBLISH_DENIED();
      // A live listing whose content changed goes back to review.
      if (row.status === 'APPROVED' && next.status === 'APPROVED' && (photosChanged || contentOf(next) !== contentOf(current))) next = { ...next, status: 'DRAFT' };
    }
    let sellerId = row.sellerId;
    if (!seller && assigned && assigned !== row.sellerId) { await requireSellerUser(tx, assigned); sellerId = assigned; }
    next.category = await canonicalCategory(tx, next.category);
    next.sourcingTypeId = await resolveSourcingTypeId(tx, next.sourcingTypeId, row.sourcingTypeId);
    await requireWorkshop(tx, next.workshopId);
    const publishing = next.status === 'APPROVED' && row.status !== 'APPROVED';
    await tx.update(productsT).set({
      ...toProductRow(next), sellerId, updatedAt: new Date(),
      ...(publishing ? { publishedBy: me.id, publishedAt: new Date() } : {}),
    }).where(eq(productsT.id, id));
    const { removedKeys } = await saveImages(tx, id, nextImages);
    return { product: await loadAdminProduct(tx, id), removedKeys };
  });
  await dropStoredPhotos(removedKeys);
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  const keys = await getDb().transaction(async tx => {
    // Lock the product first: an edit in flight finishes (and its photos are visible) before we read the list.
    const [locked] = await tx.select({ id: productsT.id }).from(productsT).where(eq(productsT.id, id)).for('update');
    if (!locked) throw new ApiError(404, 'Product not found.');
    const own = (await loadImages(tx, id)).flatMap(r => (r.key ? [r.key] : []));
    await tx.delete(productsT).where(eq(productsT.id, id));
    return unreferencedKeys(tx, own); // a file another product still shows stays
  });
  await dropStoredPhotos(keys);
}

function validateWorkshop(v: Raw): Omit<WorkshopInput, 'cityId'> {
  const type = oneOf(v.type, 'type', ['FREE', 'PAID'] as const);
  const pricePaise = type === 'FREE' ? 0 : int(v.pricePaise, 'pricePaise', 1, 10_000_000);
  if (typeof v.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) throw bad('time must be HH:MM (24-hour).');
  return {
    title: text(v.title, 'title', 200),
    type, pricePaise,
    venue: text(v.venue, 'venue', 200),
    date: validDate(v.date),
    time: v.time,
    seats: int(v.seats, 'seats', 1, 1000),
    host: text(v.host, 'host', 200),
    description: text(v.description, 'description', 2000),
    status: oneOf(v.status ?? 'APPROVED', 'status', WORKSHOP_STATUSES),
  };
}

async function requireHost(tx: Tx, id: string | undefined) {
  if (!id) return;
  const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!u) throw bad('hostId does not match a user.');
}

async function loadWorkshop(tx: Tx, id: string): Promise<Workshop> {
  const [row] = await workshopsQuery(tx).where(eq(workshopsT.id, id));
  return toAdminWorkshop(row);
}

export async function createWorkshop(input: unknown): Promise<Workshop> {
  rejectFreeTextCity(obj(input));
  const raw: Raw = { ...pick(obj(input), WORKSHOP_KEYS), status: undefined };
  const hostId = optionalUuid(raw.hostId, 'hostId');
  const data = validateWorkshop(raw);
  return getDb().transaction(async tx => {
    await requireHost(tx, hostId);
    const cityId = (await resolveCityInput(tx, raw, { required: true }))!;
    const id = await allocateId(tx, 'w');
    await tx.insert(workshopsT).values({ id, ...toWorkshopRow({ ...data, cityId }), hostId: hostId ?? null, booked: 0 });
    return loadWorkshop(tx, id);
  });
}

export async function updateWorkshop(id: string, input: unknown): Promise<Workshop> {
  rejectFreeTextCity(obj(input));
  const patch = pick(obj(input), WORKSHOP_KEYS);
  const hostId = optionalUuid(patch.hostId, 'hostId');
  return getDb().transaction(async tx => {
    const [joined] = await workshopsQuery(tx).where(eq(workshopsT.id, id)).for('update', { of: workshopsT });
    if (!joined) throw new ApiError(404, 'Workshop not found.');
    const row = joined.w;
    const next = validateWorkshop({ ...toWorkshop(joined), ...patch });
    const cityId = (await resolveCityInput(tx, { cityId: row.cityId, ...patch }, { required: true }))!;
    if (next.seats < row.booked) throw bad(`seats cannot be less than the ${row.booked} already booked.`);
    if (hostId) await requireHost(tx, hostId);
    await tx.update(workshopsT).set({
      ...toWorkshopRow({ ...next, cityId }), updatedAt: new Date(), ...(hostId ? { hostId } : patch.hostId === null || patch.hostId === '' ? { hostId: null } : {}),
    }).where(eq(workshopsT.id, id));
    return loadWorkshop(tx, id);
  });
}

/** Deleting a workshop keeps its products (they just lose the link). Returns how many were unlinked. */
export async function deleteWorkshop(id: string): Promise<{ unlinkedProducts: number }> {
  return getDb().transaction(async tx => {
    const [{ n }] = await tx.select({ n: count() }).from(productsT).where(eq(productsT.workshopId, id));
    const rows = await tx.delete(workshopsT).where(eq(workshopsT.id, id)).returning({ id: workshopsT.id });
    if (!rows.length) throw new ApiError(404, 'Workshop not found.');
    return { unlinkedProducts: n };
  });
}
