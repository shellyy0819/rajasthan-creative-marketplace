import { CITIES } from './catalog';

type SP = Record<string, string | string[] | undefined>;
export type Filters = { city?: string; category?: string; q?: string; type?: 'FREE' | 'PAID' };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilters(sp: SP): Filters {
  const out: Filters = {};
  const city = first(sp.city);
  if (city && (CITIES as readonly string[]).includes(city)) out.city = city;
  const category = first(sp.category);
  // Categories are user-created now, so any sane name is accepted; an unknown one simply finds nothing.
  if (category && category.trim() && category.length <= 60) out.category = category.trim();
  const type = first(sp.type);
  if (type === 'FREE' || type === 'PAID') out.type = type;
  const q = (first(sp.q) ?? '').trim().slice(0, 100);
  if (q) out.q = q;
  return out;
}

export const hasFilters = (f: Filters) => Object.keys(f).length > 0;
