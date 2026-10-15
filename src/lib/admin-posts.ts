import { artistKey } from './artist';
import { readDb } from './db';
import { ApiError } from './errors';
import type { Product } from './types';

export { artistKey };
export type AdminArtist = { key: string; name: string; total: number; published: number; drafts: number };
export type AdminProductQuery = { artist?: string; status?: string; q?: string };

const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;

export async function listProductsForAdmin(f: AdminProductQuery = {}): Promise<Product[]> {
  const q = (f.q ?? '').trim().toLowerCase();
  const { products } = await readDb();
  return products
    .filter(p =>
      (!f.artist || artistKey(p.seller) === artistKey(f.artist)) &&
      (!f.status || p.status === f.status) &&
      (!q || `${p.name} ${p.description} ${p.seller} ${p.category}`.toLowerCase().includes(q)))
    .sort((a, b) => idNum(b.id) - idNum(a.id));
}

export async function getProductForAdmin(id: string): Promise<Product> {
  const p = (await readDb()).products.find(x => x.id === id);
  if (!p) throw new ApiError(404, 'Product not found.');
  return p;
}

export async function listArtists(): Promise<AdminArtist[]> {
  const { products } = await readDb();
  const groups = new Map<string, AdminArtist>();
  for (const p of products) {
    const key = artistKey(p.seller);
    const a = groups.get(key) ?? { key, name: p.seller.trim().replace(/\s+/g, ' '), total: 0, published: 0, drafts: 0 };
    a.total++;
    if (p.status === 'APPROVED') a.published++; else a.drafts++;
    groups.set(key, a);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
