import Link from 'next/link';
import { CITIES, CATEGORIES } from '@/lib/catalog';
import type { Filters } from '@/lib/filters';

export function FilterForm({ action, kind, values }: { action: '/shop' | '/workshops'; kind: 'products' | 'workshops'; values: Filters }) {
  return (
    <form className="filters" action={action} method="get" role="search">
      <input name="q" defaultValue={values.q} placeholder={kind === 'products' ? 'Search crafts, makers…' : 'Search workshops…'} aria-label={kind === 'products' ? 'Search products' : 'Search workshops'} maxLength={100} />
      <select name="city" defaultValue={values.city ?? ''} aria-label="Filter by city">
        <option value="">All Rajasthan</option>
        {CITIES.map(c => <option key={c}>{c}</option>)}
      </select>
      {kind === 'products' ? (
        <select name="category" defaultValue={values.category ?? ''} aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      ) : (
        <select name="type" defaultValue={values.type ?? ''} aria-label="Filter by price">
          <option value="">Free &amp; paid</option>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
        </select>
      )}
      <button type="submit">Search</button>
      {Object.keys(values).length > 0 && <Link className="text-link" href={action}>Clear</Link>}
    </form>
  );
}
