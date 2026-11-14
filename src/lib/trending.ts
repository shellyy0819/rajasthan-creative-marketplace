import { eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { products } from '../db/schema';
import type { Product } from './types';

export const WEIGHTS = { views: 0.35, contact: 0.25, artist: 0.2, likes: 0.2 } as const;
export const WINDOW_DAYS = 7;
/** A product with views only needs this many distinct viewers to trend; a like or a contact click also qualifies on its own. */
export const MIN_VIEWS = 3;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 24;

export type Signals = { productId: string; sellerId: string; views: number; contact: number; artist: number; likes: number };
const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

/** True when the signals show real interest: enough distinct viewers, or at least one like or contact click. A single view (often the seller or admin checking a new listing) is not enough. */
export const qualifies = (r: Pick<Signals, 'views' | 'contact' | 'likes'>) => r.views >= MIN_VIEWS || r.likes > 0 || r.contact > 0;

/** Max-normalise each signal to 0..1, apply WEIGHTS, drop products that do not qualify, sort best first. */
export function scoreSignals(rows: Signals[]): (Signals & { score: number })[] {
  const max = (k: keyof typeof WEIGHTS) => Math.max(0, ...rows.map(r => r[k]));
  const m = { views: max('views'), contact: max('contact'), artist: max('artist'), likes: max('likes') };
  return rows
    .filter(qualifies)
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

const clampLimit = (limit: number) => (Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit))) : DEFAULT_LIMIT);

async function loadSignals(now: Date) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const firstDay = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000).toISOString().slice(0, 10); // the last 7 UTC days, today included
  const distinct = (type: string) => sql<number>`(select count(distinct e.actor) from product_events e where e.product_id = products.id and e.type = ${type} and e.day >= ${firstDay})`.mapWith(Number);
  return getDb().select({
    productId: products.id, sellerId: products.sellerId, name: products.name,
    views: distinct('view'), contact: distinct('contact'), artist: distinct('artist'),
    likes: sql<number>`(select count(*) from product_likes l where l.product_id = products.id and l.created_at >= ${since.toISOString()}::timestamptz)`.mapWith(Number),
  }).from(products).where(eq(products.status, 'APPROVED'));
}

export async function trending({ limit = DEFAULT_LIMIT, now = new Date() }: { limit?: number; now?: Date } = {}): Promise<Product[]> {
  const n = clampLimit(limit);
  const picked = pickDiverse(scoreSignals(await loadSignals(now)), n);
  if (!picked.length) return [];
  const db = getDb();
  const full = await productsQuery(db).where(inArray(products.id, picked.map(p => p.productId)));
  const byId = new Map(full.map(r => [r.p.id, toProduct(r)]));
  return picked.map(p => byId.get(p.productId)!).filter(Boolean);
}

export type BreakdownStatus = 'shown' | 'not-shown' | 'artist-duplicate' | 'below-threshold';
export type BreakdownRow = Signals & {
  name: string; score: number; status: BreakdownStatus; rank: number | null;
  /** Each signal's share of the score: (value / max) x weight. */
  parts: Record<keyof typeof WEIGHTS, number>;
};
export type Breakdown = { rows: BreakdownRow[]; max: Record<keyof typeof WEIGHTS, number>; weights: typeof WEIGHTS; windowDays: number; minViews: number; homeLimit: number; pageLimit: number };

/** Admin view: every approved product with its raw signals, the maths and why it is (not) on the Trending row. */
export async function trendingBreakdown({ now = new Date() }: { now?: Date } = {}): Promise<Breakdown> {
  const raw = await loadSignals(now);
  const names = new Map(raw.map(r => [r.productId, r.name]));
  const keys = Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[];
  const max = Object.fromEntries(keys.map(k => [k, Math.max(0, ...raw.map(r => r[k]))])) as Record<keyof typeof WEIGHTS, number>;
  const partsOf = (r: Signals) => Object.fromEntries(keys.map(k => [k, max[k] ? (r[k] / max[k]) * WEIGHTS[k] : 0])) as Record<keyof typeof WEIGHTS, number>;
  const ranked = scoreSignals(raw);
  const shown = new Set(pickDiverse(ranked, DEFAULT_LIMIT).map(r => r.productId));
  const onPage = new Set(pickDiverse(ranked, MAX_LIMIT).map(r => r.productId));
  const rankedIds = new Set(ranked.map(r => r.productId));
  const rows: BreakdownRow[] = [
    ...ranked.map((r, i) => ({
      ...r, name: names.get(r.productId) ?? r.productId, parts: partsOf(r), rank: i + 1,
      status: (shown.has(r.productId) ? 'shown' : onPage.has(r.productId) ? 'not-shown' : 'artist-duplicate') as BreakdownStatus,
    })),
    ...raw.filter(r => !rankedIds.has(r.productId)).map(r => ({ ...r, score: 0, parts: partsOf(r), rank: null, status: 'below-threshold' as const })),
  ];
  return { rows, max, weights: WEIGHTS, windowDays: WINDOW_DAYS, minViews: MIN_VIEWS, homeLimit: DEFAULT_LIMIT, pageLimit: MAX_LIMIT };
}
