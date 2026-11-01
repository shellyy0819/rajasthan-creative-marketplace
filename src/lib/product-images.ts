import { asc, eq } from 'drizzle-orm';
import type { Q, Tx } from '../db/client';
import { productImages } from '../db/schema';
import { bad } from './validate';
import { MAX_IMAGES, keyFromUrl, type StorageConfig } from './storage';

export type ImageRef = { url: string; key: string | null };

const LIST_MSG = `images must be a list of up to ${MAX_IMAGES} image URLs.`;

/** `undefined` when the request does not mention images (keep what is there); otherwise a clean list of unique urls. */
export function parseImages(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > MAX_IMAGES) throw bad(LIST_MSG);
  const urls = v.map(item => {
    if (typeof item !== 'string' || !item.trim()) throw bad(LIST_MSG);
    return item.trim();
  });
  if (new Set(urls).size !== urls.length) throw bad(LIST_MSG);
  return urls;
}

export async function loadImages(q: Q, productId: string): Promise<ImageRef[]> {
  const rows = await q.select({ url: productImages.url, key: productImages.s3Key }).from(productImages)
    .where(eq(productImages.productId, productId)).orderBy(asc(productImages.position));
  return rows;
}

/**
 * The only way a url becomes a product photo: it is already on this product, or it is a file in this bucket's
 * products/ area (a seller: only their own folder). Anything else, including one bad item in a list, is a 400.
 */
export async function resolveImages(
  q: Q, input: { urls: string[]; productId?: string; userId: string; isAdmin: boolean; cfg: StorageConfig | null },
): Promise<ImageRef[]> {
  const { urls, productId, userId, isAdmin, cfg } = input;
  const attached = new Map((productId ? await loadImages(q, productId) : []).map(r => [r.url, r]));
  return urls.map(url => {
    const existing = attached.get(url);
    if (existing) return existing;
    const key = cfg ? keyFromUrl(cfg, url) : undefined;
    const folder = cfg ? `${cfg.keyPrefix}products/${userId}/` : '';
    if (!key || (!isAdmin && !(key.startsWith(folder) && key.length > folder.length && !key.slice(folder.length).includes('/')))) throw bad('One or more images are not allowed.');
    return { url, key };
  });
}

/** Replaces the product's photos with `next` (positions 0..n-1). Returns the object keys that are no longer used. */
export async function saveImages(tx: Tx, productId: string, next: ImageRef[]): Promise<{ removedKeys: string[] }> {
  const before = await loadImages(tx, productId);
  const kept = new Set(next.map(r => r.url));
  const removedKeys = before.filter(r => !kept.has(r.url) && r.key).map(r => r.key as string);
  const same = before.length === next.length && before.every((r, i) => r.url === next[i].url);
  if (!same) {
    await tx.delete(productImages).where(eq(productImages.productId, productId));
    if (next.length) await tx.insert(productImages).values(next.map((r, position) => ({ productId, url: r.url, s3Key: r.key, position })));
  }
  return { removedKeys };
}
