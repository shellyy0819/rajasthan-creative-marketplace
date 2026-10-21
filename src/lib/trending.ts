import { eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { products } from '../db/schema';
import type { Product } from './types';

export const WEIGHTS = { views: 0.35, contact: 0.25, artist: 0.2, likes: 0.2 } as const;
export const WINDOW_DAYS = 7;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 24;

export type Signals = { productId: string; sellerId: string; views: number; contact: number; artist: number; likes: number };
const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

/** Max-normalise each signal to 0..1, apply WEIGHTS, drop products with no signal, sort best first. */
export function scoreSignals(rows: Signals[]): (Signals & { score: number })[] {
  const max = (k: keyof typeof WEIGHTS) => Math.max(0, ...rows.map(r => r[k]));
  const m = { views: max('views'), contact: max('contact'), artist: max('artist'), likes: max('likes') };
  return rows
    .filter(r => r.views + r.contact + r.artist + r.likes > 0)
    .map(r => ({ ...r, score: (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + (m[k] ? (r[k] / m[k]) * WEIGHTS[k] : 0), 0) }))
    .sort((a, b) => b.score - a.score || b.likes - a.likes || idNum(b.productId) - idNum(a.productId));
}

/** Keeps the best `perArtist` products of every artist, preserving order, up to `limit`. */
export function pickDiverse<T extends { sellerId: string }>(sorted: T[], limit: number, perArtist = 1): T[] {
  const seen = new Map<string, number>();
  const out: T[] = [];
  for (const r of sorted) {
    if (out.length >= limit) break;
    const n = seen.get(r.sellerId) ?? 0;
    if (n >= perArtist) continue;
    seen.set(r.sellerId, n + 1);
    out.push(r);
  }
  return out;
}

export async function trending({ limit = DEFAULT_LIMIT, now = new Date() }: { limit?: number; now?: Date } = {}): Promise<Product[]> {
  const n = Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))) : DEFAULT_LIMIT;
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const firstDay = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000).toISOString().slice(0, 10); // the last 7 UTC days, today included
  const distinct = (type: string) => sql<number>`(select count(distinct e.actor) from product_events e where e.product_id = products.id and e.type = ${type} and e.day >= ${firstDay})`.mapWith(Number);
  const db = getDb();
  const rows = await db.select({
    productId: products.id, sellerId: products.sellerId,
    views: distinct('view'), contact: distinct('contact'), artist: distinct('artist'),
    likes: sql<number>`(select count(*) from product_likes l where l.product_id = products.id and l.created_at >= ${since.toISOString()}::timestamptz)`.mapWith(Number),
  }).from(products).where(eq(products.status, 'APPROVED'));
  const picked = pickDiverse(scoreSignals(rows), n);
  if (!picked.length) return [];
  const full = await productsQuery(db).where(inArray(products.id, picked.map(p => p.productId)));
  const byId = new Map(full.map(r => [r.p.id, toProduct(r)]));
  return picked.map(p => byId.get(p.productId)!).filter(Boolean);
}
