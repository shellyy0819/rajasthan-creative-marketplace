import { mutateDb } from './db';
import { ApiError } from './errors';
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
function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw bad(`${field} must be one of: ${allowed.join(', ')}.`);
  return v as T;
}
function nextId(prefix: string, ids: string[]): string {
  const max = ids.reduce((m, id) => Math.max(m, Number(new RegExp(`^${prefix}(\\d+)$`).exec(id)?.[1] ?? 0)), 0);
  return `${prefix}${max + 1}`;
}

const PRODUCT_KEYS = ['name', 'category', 'city', 'pricePaise', 'seller', 'description', 'stock', 'status', 'artistName', 'instagram', 'youtube', 'phone', 'email'] as const;
const WORKSHOP_KEYS = ['title', 'type', 'pricePaise', 'city', 'venue', 'date', 'time', 'seats', 'host', 'description', 'status'] as const;
const STATUSES = ['APPROVED', 'DRAFT'] as const;

function pick(input: Raw, keys: readonly string[]): Raw {
  return Object.fromEntries(keys.filter(k => k in input).map(k => [k, input[k]]));
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
    phone: optionalText(v.phone, 'phone', 40),
    email,
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
  const data = validateProduct({ ...pick(obj(input), PRODUCT_KEYS), status: undefined });
  return mutateDb(db => {
    const p: Product = { id: nextId('p', db.products.map(x => x.id)), ...data };
    db.products.push(p);
    return p;
  });
}

export async function updateProduct(id: string, input: unknown): Promise<Product> {
  const patch = pick(obj(input), PRODUCT_KEYS);
  return mutateDb(db => {
    const p = db.products.find(x => x.id === id);
    if (!p) throw new ApiError(404, 'Product not found.');
    Object.assign(p, validateProduct({ ...p, ...patch }));
    return p;
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await mutateDb(db => {
    const i = db.products.findIndex(x => x.id === id);
    if (i < 0) throw new ApiError(404, 'Product not found.');
    db.products.splice(i, 1);
  });
}

export async function createWorkshop(input: unknown): Promise<Workshop> {
  const data = validateWorkshop({ ...pick(obj(input), WORKSHOP_KEYS), status: undefined });
  return mutateDb(db => {
    const w: Workshop = { id: nextId('w', db.workshops.map(x => x.id)), ...data, booked: 0 };
    db.workshops.push(w);
    return w;
  });
}

export async function updateWorkshop(id: string, input: unknown): Promise<Workshop> {
  const patch = pick(obj(input), WORKSHOP_KEYS);
  return mutateDb(db => {
    const w = db.workshops.find(x => x.id === id);
    if (!w) throw new ApiError(404, 'Workshop not found.');
    const next = validateWorkshop({ ...w, ...patch });
    if (next.seats < w.booked) throw bad(`seats cannot be less than the ${w.booked} already booked.`);
    Object.assign(w, next);
    return w;
  });
}

export async function deleteWorkshop(id: string): Promise<void> {
  await mutateDb(db => {
    const i = db.workshops.findIndex(x => x.id === id);
    if (i < 0) throw new ApiError(404, 'Workshop not found.');
    db.workshops.splice(i, 1);
  });
}
