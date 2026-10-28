'use client';
import { useEffect, useRef, useState } from 'react';
import type { Product, Workshop } from '@/lib/types';
import { DEFAULT_CATEGORIES } from '@/lib/catalog-shared';
import { cityLabeller } from '@/lib/city-label';
import { ProductGrid } from './ProductGrid';
import { PageLoader } from './PageLoader';
import { WorkshopList } from './WorkshopList';

type Values = { city?: string; category?: string; type?: string; q?: string };
type CityOption = { name: string; slug: string; state?: string };
/** `cities` are the active cities (from the server), offered in the city filter by slug (labelled with the state when a name repeats). */
type Props =
  | { kind: 'products'; initialItems: Product[]; initialValues: Values; cities: readonly CityOption[]; categories?: readonly string[] }
  | { kind: 'workshops'; initialItems: Workshop[]; initialValues: Values; cities: readonly CityOption[] };

const SEARCH_DELAY_MS = 300;
const CONFIG = {
  products: { endpoint: '/api/products', path: '/shop', selectKey: 'category' as const },
  workshops: { endpoint: '/api/workshops', path: '/workshops', selectKey: 'type' as const },
};

function buildQs(v: Values, selectKey: 'category' | 'type'): string {
  const sp = new URLSearchParams();
  if (v.city) sp.set('city', v.city);
  if (v[selectKey]) sp.set(selectKey, v[selectKey]!);
  const q = (v.q ?? '').trim();
  if (q) sp.set('q', q);
  return sp.toString();
}

export function LiveCatalog(props: Props) {
  const { kind } = props;
  const { endpoint, path, selectKey } = CONFIG[kind];
  const [values, setValues] = useState<Values>(props.initialValues);
  const [items, setItems] = useState<(Product | Workshop)[]>(props.initialItems);
  const [delay, setDelay] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const applied = useRef(buildQs(props.initialValues, selectKey));

  useEffect(() => {
    const qs = buildQs(values, selectKey);
    if (qs === applied.current) { setError(''); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(qs ? `${endpoint}?${qs}` : endpoint, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Something went wrong');
        if (ctrl.signal.aborted) return;
        setItems(data);
        applied.current = qs;
        window.history.replaceState(null, '', qs ? `${path}?${qs}` : path);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setError((e as Error).message || 'Could not load results. Please try again.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, delay);
    return () => { clearTimeout(timer); ctrl.abort(); setLoading(false); };
  }, [values, delay, endpoint, path, selectKey]);

  // The filter accepts a name or a slug (?city=udaipur): show the matching city, or keep an unknown value visible.
  const cityValue = values.city ?? '';
  const cityMatch = props.cities.find(c => c.slug === cityValue.toLowerCase()) ?? props.cities.find(c => c.name.toLowerCase() === cityValue.trim().toLowerCase());
  const labelOf = cityLabeller(props.cities);
  const cityLabel = cityMatch ? labelOf(cityMatch) : cityValue;
  const dirty = Object.values(values).some(Boolean);
  const n = items.length;
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
        <option value="">All India</option>
        {props.cities.map(c => <option key={c.slug} value={c.slug}>{labelOf(c)}</option>)}
        {cityValue && !cityMatch && <option value={cityValue}>{cityValue}</option>}
      </select>
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
      <button type="submit">Search</button>
      {dirty && <button type="button" className="text-link" onClick={() => { setDelay(0); setValues({}); }}>Clear</button>}
    </form>
  );

  const results = (
    <div aria-busy={loading} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
      <PageLoader show={loading} blocking={false} label="Searching…" />
      {error && <p role="alert" className="fine-print" style={{ color: '#a74d35', textAlign: 'left' }}>Couldn’t update results: {error}</p>}
      {kind === 'products' ? <ProductGrid products={items as Product[]} /> : <WorkshopList workshops={items as Workshop[]} />}
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
