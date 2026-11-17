import Link from 'next/link';
import { listCategoryIndex } from '@/lib/category-pages';
import '../app/categories/categories.css';

const SHOWN = 8;

/** Home page block: the busiest categories (those with the most products) as links to their pages, and a link to all of them. Nothing when no category has products. */
export async function ShopByCategory() {
  const top = (await listCategoryIndex()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, SHOWN);
  if (top.length === 0) return null;
  return (
    <section className="section" aria-labelledby="shop-by-cat-h">
      <div className="section-heading">
        <div><span className="eyebrow">FIND YOUR CRAFT</span><h2 id="shop-by-cat-h">Shop by category</h2></div>
        <Link className="text-link" href="/categories">All categories →</Link>
      </div>
      <ul className="cat-list cat-list-home">
        {top.map(c => (
          <li key={c.slug}>
            <Link href={`/categories/${c.slug}`}><span>{c.name}</span><small>{c.count}</small></Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
