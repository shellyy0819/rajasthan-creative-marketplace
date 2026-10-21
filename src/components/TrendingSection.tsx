import Link from 'next/link';
import { ProductGrid } from './ProductGrid';
import { trending } from '@/lib/trending';

/** Home-page row of what people are loving this week. Hidden until something actually trends. */
export async function TrendingSection() {
  const items = await trending({ limit: 6 });
  if (!items.length) return null;
  return (
    <section className="section" id="trending" aria-labelledby="trending-h">
      <div className="section-heading">
        <div><span className="eyebrow">LOVED THIS WEEK</span><h2 id="trending-h">Trending now</h2></div>
        <Link className="text-link" href="/trending">Show all →</Link>
      </div>
      <ProductGrid products={items} />
    </section>
  );
}
