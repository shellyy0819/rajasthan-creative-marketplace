import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { allocateId } from '../db/ids';
import { toProduct, toProductRow, toWorkshop, toWorkshopRow } from '../db/mappers';
import { products as productsT, workshops as workshopsT } from '../db/schema';
import { ApiError } from './errors';
import { normalizePhone, PHONE_HINT } from './phone';
import { CATEGORIES, CITIES } from './catalog';
import type { Product, Workshop } from './types';

type Raw = Record<string, unknown>;
const bad = (msg: string) => new ApiError(400, msg);

function obj(input: unknown): Raw {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('Body must be a JSON object.');
  return input as Raw;
}
function text(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw bad(`${field} must be a non-empty string up to ${max} characters.`);
  return v.trim();
}
function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad(`${field} must be an integer between ${min} and ${max}.`);
  return v;
}
function optionalText(v: unknown, field: string, max: number): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.trim().length > max) throw bad(`${field} must be text up to ${max} characters.`);
  return v.trim() || undefined;
}
function optionalPhone(v: unknown): string | undefined {
  const t = optionalText(v, 'phone', 40);
  if (t === undefined) return undefined;
  const n = normalizePhone(t);
  if (!n) throw bad(`phone is invalid. ${PHONE_HINT}`);
  return n;
}
function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw bad(`${field} must be one of: ${allowed.join(', ')}.`);
  return v as T;
}
// Ids are never reused: a persisted counter survives deletes, so a stale form/URL can never hit a different, newer record.
const PRODUCT_KEYS = ['name', 'category', 'city', 'pricePaise', 'seller', 'description', 'stock', 'status', 'artistName', 'instagram', 'youtube', 'phone', 'email', 'imageUrl'] as const;
const WORKSHOP_KEYS = ['title', 'type', 'pricePaise', 'city', 'venue', 'date', 'time', 'seats', 'host', 'description', 'status'] as const;
const STATUSES = ['APPROVED', 'DRAFT'] as const;

function pick(input: Raw, keys: readonly string[]): Raw {
  return Object.fromEntries(keys.filter(k => k in input).map(k => [k, input[k]]));
}

function optionalImageUrl(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const msg = 'imageUrl must be an https URL up to 500 characters.';
  if (typeof v !== 'string' || v.trim().length > 500) throw bad(msg);
  let u: URL;
  try { u = new URL(v.trim()); } catch { throw bad(msg); }
  if (u.protocol !== 'https:' || u.username || u.password) throw bad(msg);
  return u.toString();
}

function validateProduct(v: Raw): Omit<Product, 'id'> {
  const email = optionalText(v.email, 'email', 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('email must be a valid email address.');
  return {
    name: text(v.name, 'name', 200),
    category: oneOf(v.category, 'category', CATEGORIES),
    city: oneOf(v.city, 'city', CITIES),
    pricePaise: int(v.pricePaise, 'pricePaise', 0, 10_000_000),
    seller: text(v.seller, 'seller', 200),
    description: text(v.description, 'description', 2000),
    stock: int(v.stock, 'stock', 0, 100_000),
    status: oneOf(v.status ?? 'APPROVED', 'status', STATUSES),
    artistName: optionalText(v.artistName, 'artistName', 200),
    instagram: optionalText(v.instagram, 'instagram', 200),
    youtube: optionalText(v.youtube, 'youtube', 200),
    phone: optionalPhone(v.phone),
    email,
    imageUrl: optionalImageUrl(v.imageUrl),
  };
}

function validDate(d: unknown): string {
  const ok = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && (() => {
    const t = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
  })();
  if (!ok) throw bad('date must be a real date in YYYY-MM-DD format.');
  return d as string;
}

function validateWorkshop(v: Raw): Omit<Workshop, 'id' | 'booked'> {
  const type = oneOf(v.type, 'type', ['FREE', 'PAID'] as const);
  const pricePaise = type === 'FREE' ? 0 : int(v.pricePaise, 'pricePaise', 1, 10_000_000);
  if (typeof v.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) throw bad('time must be HH:MM (24-hour).');
  return {
    title: text(v.title, 'title', 200),
    type, pricePaise,
    city: oneOf(v.city, 'city', CITIES),
    venue: text(v.venue, 'venue', 200),
    date: validDate(v.date),
    time: v.time,
    seats: int(v.seats, 'seats', 1, 1000),
    host: text(v.host, 'host', 200),
    description: text(v.description, 'description', 2000),
    status: oneOf(v.status ?? 'APPROVED', 'status', STATUSES),
  };
}

export async function createProduct(input: unknown): Promise<Product> {
  const data = validateProduct(pick(obj(input), PRODUCT_KEYS));
  return getDb().transaction(async tx => {
    const id = await allocateId(tx, 'p');
    const [row] = await tx.insert(productsT).values({ id, ...toProductRow(data) }).returning();
    return toProduct(row);
  });
}

export async function updateProduct(id: string, input: unknown): Promise<Product> {
  const patch = pick(obj(input), PRODUCT_KEYS);
  return getDb().transaction(async tx => {
    const [row] = await tx.select().from(productsT).where(eq(productsT.id, id)).for('update');
    if (!row) throw new ApiError(404, 'Product not found.');
    const next = validateProduct({ ...toProduct(row), ...patch });
    const [saved] = await tx.update(productsT).set(toProductRow(next)).where(eq(productsT.id, id)).returning();
    return toProduct(saved);
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const rows = await getDb().delete(productsT).where(eq(productsT.id, id)).returning({ id: productsT.id });
  if (!rows.length) throw new ApiError(404, 'Product not found.');
}

export async function createWorkshop(input: unknown): Promise<Workshop> {
  const data = validateWorkshop({ ...pick(obj(input), WORKSHOP_KEYS), status: undefined });
  return getDb().transaction(async tx => {
    const id = await allocateId(tx, 'w');
    const [row] = await tx.insert(workshopsT).values({ id, ...toWorkshopRow(data), booked: 0 }).returning();
    return toWorkshop(row);
  });
}

export async function updateWorkshop(id: string, input: unknown): Promise<Workshop> {
  const patch = pick(obj(input), WORKSHOP_KEYS);
  return getDb().transaction(async tx => {
    const [row] = await tx.select().from(workshopsT).where(eq(workshopsT.id, id)).for('update');
    if (!row) throw new ApiError(404, 'Workshop not found.');
    const next = validateWorkshop({ ...toWorkshop(row), ...patch });
    if (next.seats < row.booked) throw bad(`seats cannot be less than the ${row.booked} already booked.`);
    const [saved] = await tx.update(workshopsT).set(toWorkshopRow(next)).where(eq(workshopsT.id, id)).returning();
    return toWorkshop(saved);
  });
}

export async function deleteWorkshop(id: string): Promise<void> {
  const rows = await getDb().delete(workshopsT).where(eq(workshopsT.id, id)).returning({ id: workshopsT.id });
  if (!rows.length) throw new ApiError(404, 'Workshop not found.');
}
