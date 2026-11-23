type SP = Record<string, string | string[] | undefined>;
export type Filters = { city?: string; category?: string; source?: string; q?: string; type?: 'FREE' | 'PAID'; mode?: 'in_person' | 'online'; /** Workshops: only the ones still on, or only the ended ones; left out, both. */ status?: 'open' | 'ended' };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilters(sp: SP): Filters {
  const out: Filters = {};
  const city = first(sp.city);
  // Cities are data now: any sane name or slug is accepted; an unknown one simply finds nothing.
  if (city && city.trim() && city !== 'All India' && city.length <= 100) out.city = city.trim();
  const category = first(sp.category);
  // Categories are user-created now, so any sane name is accepted; an unknown one simply finds nothing.
  if (category && category.trim() && category.length <= 60) out.category = category.trim();
  // The sourcing type of a product (Handmade, Curated...): admin-managed names, so any sane name is accepted; an unknown one finds nothing.
  const source = first(sp.source);
  if (source && source.trim() && source.length <= 40) out.source = source.trim();
  const type = first(sp.type);
  if (type === 'FREE' || type === 'PAID') out.type = type;
  const mode = first(sp.mode);
  if (mode === 'in_person' || mode === 'online') out.mode = mode;
  const status = first(sp.status);
  if (status === 'open' || status === 'ended') out.status = status;
  const q = (first(sp.q) ?? '').trim().slice(0, 100);
  if (q) out.q = q;
  return out;
}

export const hasFilters = (f: Filters) => Object.keys(f).length > 0;
