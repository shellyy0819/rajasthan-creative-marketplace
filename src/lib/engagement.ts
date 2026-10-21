import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productEvents, productLikes, products } from '../db/schema';
import { ApiError } from './errors';

export type EventType = 'view' | 'contact' | 'artist';
const NOT_FOUND = () => new ApiError(404, 'Product not found.');
const MAX_IDS = 60;

async function publishedStatus(id: string): Promise<'APPROVED' | 'OTHER' | 'MISSING'> {
  const [row] = await getDb().select({ status: products.status }).from(products).where(eq(products.id, id));
  return !row ? 'MISSING' : row.status === 'APPROVED' ? 'APPROVED' : 'OTHER';
}
const likeCount = async (id: string) => (await getDb().select({ n: count() }).from(productLikes).where(eq(productLikes.productId, id)))[0].n;

export async function likeProduct(productId: string, actor: string): Promise<{ liked: true; count: number }> {
  if ((await publishedStatus(productId)) !== 'APPROVED') throw NOT_FOUND();
  await getDb().insert(productLikes).values({ productId, actor }).onConflictDoNothing();
  return { liked: true, count: await likeCount(productId) };
}

export async function unlikeProduct(productId: string, actor: string): Promise<{ liked: false; count: number }> {
  if ((await publishedStatus(productId)) === 'MISSING') throw NOT_FOUND();
  await getDb().delete(productLikes).where(and(eq(productLikes.productId, productId), eq(productLikes.actor, actor)));
  return { liked: false, count: await likeCount(productId) };
}

export async function likeState(ids: string[], actor?: string): Promise<{ counts: Record<string, number>; liked: string[] }> {
  const wanted = [...new Set(ids.filter(i => /^p\d+$/.test(i)))].slice(0, MAX_IDS);
  if (!wanted.length) return { counts: {}, liked: [] };
  const rows = await getDb().select({
    id: products.id,
    n: sql<number>`(select count(*) from product_likes l where l.product_id = ${products.id})`.mapWith(Number),
    mine: actor ? sql<boolean>`exists (select 1 from product_likes l where l.product_id = ${products.id} and l.actor = ${actor})` : sql<boolean>`false`,
  }).from(products).where(and(inArray(products.id, wanted), eq(products.status, 'APPROVED')));
  return { counts: Object.fromEntries(rows.map(r => [r.id, r.n])), liked: rows.filter(r => r.mine).map(r => r.id) };
}

export async function recordEvent(e: { productId: string; type: EventType; actor: string }, now = new Date()): Promise<'recorded' | 'duplicate' | 'ignored'> {
  if ((await publishedStatus(e.productId)) !== 'APPROVED') return 'ignored';
  const day = now.toISOString().slice(0, 10);
  const rows = await getDb().insert(productEvents).values({ productId: e.productId, type: e.type, actor: e.actor, day }).onConflictDoNothing().returning({ id: productEvents.id });
  return rows.length ? 'recorded' : 'duplicate';
}
