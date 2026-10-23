import { ApiError } from './errors';
import { normalizeQuery } from './search';

/** Photon (komoot) is a free, key-less type-ahead geocoder over OpenStreetMap data. Fair use only; see the README. */
export const PLACES_URL = 'https://photon.komoot.io/api/';
const INDIA_BBOX = '68.1,6.7,97.4,35.7'; // west,south,east,north
const FETCH_LIMIT = 20;
const RESULTS = 6;
const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 200;
const UNAVAILABLE = () => new ApiError(502, 'Place search is unavailable.');

export type Place = { label: string; name: string; state?: string };
type Props = { osm_value?: unknown; name?: unknown; street?: unknown; city?: unknown; district?: unknown; county?: unknown; state?: unknown; countrycode?: unknown };

/** Lower is better: bigger, better-known kinds of place first. */
const KIND_RANK: Record<string, number> = { city: 0, town: 1, suburb: 2, neighbourhood: 2, quarter: 2, locality: 2, village: 3, hamlet: 4 };
const kindOf = (p: Props) => KIND_RANK[str(p.osm_value)] ?? 5;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** "Name, street, area, state" with repeated parts removed ("Udaipur, Udaipur, Rajasthan" -> "Udaipur, Rajasthan"). */
export function placeLabel(p: Props): string {
  const parts = [str(p.name), str(p.street), str(p.city) || str(p.district) || str(p.county), str(p.state)].filter(Boolean);
  const seen = new Set<string>();
  return parts.filter(x => (seen.has(x.toLowerCase()) ? false : (seen.add(x.toLowerCase()), true))).join(', ');
}

const cache = new Map<string, { at: number; value: Place[] }>();
export const clearPlacesCache = () => cache.clear();

export async function searchPlaces(q: string, fetchImpl: typeof fetch = fetch): Promise<Place[]> {
  const needle = normalizeQuery(q);
  if (needle.length < 2) return [];
  const key = needle.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const url = new URL(PLACES_URL);
  url.search = new URLSearchParams({ q: needle, limit: String(FETCH_LIMIT), lang: 'en', bbox: INDIA_BBOX }).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let features: unknown;
  try {
    const res = await fetchImpl(url.toString(), { signal: ctrl.signal, headers: { 'user-agent': 'Craftology/1.0 (marketplace place suggestions)', accept: 'application/json' } });
    if (!res.ok) throw UNAVAILABLE();
    features = ((await res.json()) as { features?: unknown })?.features;
  } catch (e) {
    throw e instanceof ApiError ? e : UNAVAILABLE();
  } finally {
    clearTimeout(timer);
  }
  if (!Array.isArray(features)) throw UNAVAILABLE();

  const found: (Place & { kind: number })[] = [];
  for (const f of features as { properties?: Props | null }[]) {
    const p = f?.properties;
    if (!p || typeof p !== 'object' || p.countrycode !== 'IN') continue;
    const label = placeLabel(p);
    const name = str(p.name);
    if (!label || !name) continue;
    found.push({ label, name, kind: kindOf(p), ...(str(p.state) ? { state: str(p.state) } : {}) });
  }
  // Rajasthan first (the marketplace's home), then the rest of India; within each, names that start with what was typed,
  // then cities and towns before villages and landmarks. Array.sort is stable, so Photon's own relevance order breaks ties.
  const typed = needle.toLowerCase();
  const starts = (p: Place) => Number(p.name.toLowerCase().startsWith(typed));
  const ordered = found.map((p, i) => ({ p, i })).sort((a, b) =>
    Number(b.p.state === 'Rajasthan') - Number(a.p.state === 'Rajasthan') || starts(b.p) - starts(a.p) || a.p.kind - b.p.kind || a.i - b.i).map(x => x.p);
  const seen = new Set<string>();
  const value: Place[] = ordered.filter(p => (seen.has(p.label.toLowerCase()) ? false : (seen.add(p.label.toLowerCase()), true)))
    .slice(0, RESULTS).map(({ label, name, state }) => ({ label, name, ...(state ? { state } : {}) }));

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}
