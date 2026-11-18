'use client';
import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { Product, Workshop } from '@/lib/types';
import { DEFAULT_CATEGORIES, SHOP_PAGE_SIZE } from '@/lib/catalog-shared';
import { cityLabeller } from '@/lib/city-label';
import { dataKey, useDataVersion } from './DataVersion';
import { ProductGrid } from './ProductGrid';
import { PageLoader } from './PageLoader';
import { WorkshopList } from './WorkshopList';

type Values = { city?: string; category?: string; source?: string; type?: string; q?: string; mode?: string };
type CityOption = { name: string; slug: string; state?: string };
/** `cities` are the active cities (from the server), offered in the city filter by slug (labelled with the state when a name repeats). */
type Props =
  | { kind: 'products'; initialItems: Product[]; /** How many products match in all; the first page is `initialItems`. */ initialTotal?: number; initialValues: Values; cities: readonly CityOption[]; categories?: readonly string[]; sourcingTypes?: readonly string[] }
  | { kind: 'workshops'; initialItems: Workshop[]; initialValues: Values; cities: readonly CityOption[] };

const SEARCH_DELAY_MS = 300;
type Page = { items: (Product | Workshop)[]; total: number };
const CONFIG = {
  products: { endpoint: '/api/products', path: '/shop', selectKey: 'category' as const },
  workshops: { endpoint: '/api/workshops', path: '/workshops', selectKey: 'type' as const },
};

function buildQs(v: Values, selectKey: 'category' | 'type'): string {
  const sp = new URLSearchParams();
  if (v.city) sp.set('city', v.city);
  if (v[selectKey]) sp.set(selectKey, v[selectKey]!);
  if (selectKey === 'category' && v.source) sp.set('source', v.source);
  if (selectKey === 'type' && v.mode) sp.set('mode', v.mode);
  const q = (v.q ?? '').trim();
  if (q) sp.set('q', q);
  return sp.toString();
}

export function LiveCatalog(props: Props) {
  const { kind } = props;
  const { endpoint, path, selectKey } = CONFIG[kind];
  const version = useDataVersion();
  const [values, setValues] = useState<Values>(props.initialValues);
  const [delay, setDelay] = useState(0);
  // `values` is what the form shows; `applied` is what the query runs with (after the typing delay).
  const [applied, setApplied] = useState(() => buildQs(props.initialValues, selectKey));
  const qs = buildQs(values, selectKey);
  const initialQs = useRef(applied).current;

  useEffect(() => {
    if (qs === applied) return;
    const timer = setTimeout(() => setApplied(qs), delay);
    return () => clearTimeout(timer);
  }, [qs, applied, delay]);

  // Products arrive a page at a time (the total comes back in X-Total-Count); workshops are one short list.
  const paged = kind === 'products';
  const initialTotal = (props.kind === 'products' ? props.initialTotal : undefined) ?? props.initialItems.length;
  const { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, error: queryError } = useInfiniteQuery<Page, Error, InfiniteData<Page, number>, ReturnType<typeof dataKey>, number>({
    queryKey: dataKey(version, kind, applied),
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const sp = new URLSearchParams(applied);
      if (paged) { sp.set('limit', String(SHOP_PAGE_SIZE)); sp.set('offset', String(pageParam)); }
      const query = sp.toString();
      const res = await fetch(query ? `${endpoint}?${query}` : endpoint, { signal });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Something went wrong');
      return { items: body, total: paged ? Number(res.headers?.get('X-Total-Count') ?? body.length) : body.length };
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return paged && last.items.length > 0 && loaded < last.total ? loaded : undefined;
    },
    // The server already rendered the first page: seed the cache with it, and keep the old list on screen while a new search loads.
    initialData: applied === initialQs ? { pages: [{ items: props.initialItems, total: initialTotal }], pageParams: [0] } : undefined,
    placeholderData: keepPreviousData,
    // Results stay as fetched until the data version changes (an admin or seller saved something); nothing refetches on a timer or on focus.
    staleTime: Infinity,
    gcTime: 60 * 60_000,
  });
  // When a new search fails there is nothing for it in the cache, so the last good list (the one the server rendered) stays on screen.
  const pages = data?.pages ?? [{ items: props.initialItems, total: initialTotal }];
  // Pages are cut by position, so a product added meanwhile can shift one onto the next page: show each only once.
  const items = (() => { const seen = new Set<string>(); return pages.flatMap(p => p.items).filter(i => !seen.has(i.id) && seen.add(i.id)); })();
  const total = pages[pages.length - 1].total;
  const loading = isFetching && !isFetchingNextPage;
  const error = queryError ? (queryError.message || 'Could not load results. Please try again.') : '';

  // Scrolling near the end of the grid loads the next page by itself; the "Show more" button does the same for keyboard users.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || queryError || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage(); }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, queryError, isFetchingNextPage, fetchNextPage, items.length]);

  // Keep the address bar in step with the results being shown.
  const searched = useRef(false);
  useEffect(() => {
    if (applied !== initialQs) searched.current = true;
    if (searched.current) window.history.replaceState(null, '', applied ? `${path}?${applied}` : path);
  }, [applied, initialQs, path]);

  // The filter accepts a name or a slug (?city=udaipur): show the matching city, or keep an unknown value visible.
  const cityValue = values.city ?? '';
  const cityMatch = props.cities.find(c => c.slug === cityValue.toLowerCase()) ?? props.cities.find(c => c.name.toLowerCase() === cityValue.trim().toLowerCase());
  const labelOf = cityLabeller(props.cities);
  const cityLabel = cityMatch ? labelOf(cityMatch) : cityValue;
  const dirty = Object.values(values).some(Boolean);
  const n = total;
  const summary = kind === 'products'
    ? `${n} ${n === 1 ? 'find' : 'finds'} to love${cityLabel ? ` in ${cityLabel}` : ''}.`
    : `${n} ${n === 1 ? 'experience' : 'experiences'}${cityLabel ? ` in ${cityLabel}` : ' around India'}.`;
  const set = (patch: Values, wait: number) => { setDelay(wait); setValues(v => ({ ...v, ...patch })); };

  const form = (
    <form className="filters" action={path} method="get" role="search" onSubmit={e => { e.preventDefault(); setDelay(0); setValues(v => ({ ...v })); }}>
      <input
        name="q" value={values.q ?? ''} maxLength={100}
        onChange={e => set({ q: e.target.value }, SEARCH_DELAY_MS)}
        placeholder={kind === 'products' ? 'Search crafts, makers…' : 'Search workshops…'}
        aria-label={kind === 'products' ? 'Search products' : 'Search workshops'}
      />
      <select name="city" value={cityMatch?.slug ?? cityValue} onChange={e => set({ city: e.target.value }, 0)} aria-label="Filter by city">
        <option value="">All Cities</option>
        {props.cities.map(c => <option key={c.slug} value={c.slug}>{labelOf(c)}</option>)}
        {cityValue && !cityMatch && <option value={cityValue}>{cityValue}</option>}
      </select>
      {kind === 'products' && props.kind === 'products' && props.sourcingTypes && props.sourcingTypes.length > 0 && (
        <select name="source" value={values.source ?? ''} onChange={e => set({ source: e.target.value }, 0)} aria-label="Filter by type">
          <option value="">All types</option>
          {props.sourcingTypes.map(t => <option key={t}>{t}</option>)}
          {values.source && !props.sourcingTypes.includes(values.source) && <option>{values.source}</option>}
        </select>
      )}
      {kind === 'products' ? (
        <select name="category" value={values.category ?? ''} onChange={e => set({ category: e.target.value }, 0)} aria-label="Filter by category">
          <option value="">All categories</option>
          {(props.kind === 'products' && props.categories ? props.categories : DEFAULT_CATEGORIES).map(c => <option key={c}>{c}</option>)}
        </select>
      ) : (
        <select name="type" value={values.type ?? ''} onChange={e => set({ type: e.target.value }, 0)} aria-label="Filter by price">
          <option value="">Free &amp; paid</option>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
        </select>
      )}
      {kind === 'workshops' && (
        <select name="mode" value={values.mode ?? ''} onChange={e => set({ mode: e.target.value }, 0)} aria-label="Filter by format">
          <option value="">In person &amp; online</option>
          <option value="in_person">In person</option>
          <option value="online">Online</option>
        </select>
      )}
      <button type="submit">Search</button>
      {dirty && <button type="button" className="text-link" onClick={() => { setDelay(0); setValues({}); }}>Clear</button>}
    </form>
  );

  const results = (
    <div aria-busy={loading} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
      {/* The shop only dims the old results while the new ones load; workshops keep the centred spinner. */}
      {kind !== 'products' && <PageLoader show={loading} blocking={false} label="" />}
      {error && <p role="alert" className="fine-print" style={{ color: '#a74d35', textAlign: 'left' }}>Couldn’t update results: {error}</p>}
      {kind === 'products' ? <ProductGrid products={items as Product[]} loading={loading} /> : <WorkshopList workshops={items as Workshop[]} loading={loading} />}
      {paged && (hasNextPage || (queryError && items.length > 0)) && (
        <div ref={sentinel} className="craft-more">
          <button type="button" className="button outline" disabled={isFetchingNextPage} aria-busy={isFetchingNextPage} onClick={() => void (hasNextPage ? fetchNextPage() : refetch())}>
            {queryError ? 'Try again' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );

  const body = (
    <>
      <p className="muted" role="status" style={{ margin: '0 0 12px' }}>{summary}</p>
      {form}
      {results}
    </>
  );
  return kind === 'products'
    ? <section className="section" style={{ paddingTop: 10 }}>{body}</section>
    : <section className="workshop-band" style={{ display: 'block', marginTop: 30 }}>{body}</section>;
}
