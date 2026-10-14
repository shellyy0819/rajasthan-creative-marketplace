import { readDb } from './db';
import { productSlug, workshopSlug } from './catalog-shared';
import type { Product, Workshop } from './types';

export { CITIES, CATEGORIES, citySlug, cityFromSlug, productSlug, workshopSlug } from './catalog-shared';

export type ProductFilter = { city?: string; category?: string; q?: string };
export type WorkshopFilter = { city?: string; type?: string; q?: string };

const anyCity = (c?: string) => !c || c === 'All Rajasthan';

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  const q = (f.q ?? '').toLowerCase();
  const { products } = await readDb();
  return products.filter(
    p =>
      p.status === 'APPROVED' &&
      (anyCity(f.city) || p.city === f.city) &&
      (!f.category || f.category === 'All categories' || p.category === f.category) &&
      (!q || `${p.name} ${p.description} ${p.seller} ${p.category}`.toLowerCase().includes(q)),
  );
}

export async function listWorkshops(f: WorkshopFilter = {}): Promise<Workshop[]> {
  const q = (f.q ?? '').toLowerCase();
  const { workshops } = await readDb();
  return workshops.filter(
    w =>
      w.status === 'APPROVED' &&
      (anyCity(f.city) || w.city === f.city) &&
      (!f.type || f.type === 'ALL' || w.type === f.type) &&
      (!q || `${w.title} ${w.description} ${w.venue} ${w.host}`.toLowerCase().includes(q)),
  );
}

export async function getProductBySlug(slug: string) {
  return (await listProducts()).find(p => productSlug(p) === slug);
}
export async function getWorkshopBySlug(slug: string) {
  return (await listWorkshops()).find(w => workshopSlug(w) === slug);
}
