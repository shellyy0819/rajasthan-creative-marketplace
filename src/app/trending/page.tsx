import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { SectionLoader } from '@/components/SectionLoader';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { trending } from '@/lib/trending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Trending handmade finds',
  description: 'The handmade products people are loving this week, one favourite from each artist.',
  path: '/trending',
});

async function TrendingGrid() {
  return <ProductGrid products={await trending({ limit: 24 })} emptyMessage="Nothing is trending yet. Like a product to start the trend." />;
}

export default async function TrendingPage() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Trending', path: '/trending' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">LOVED THIS WEEK</span>
        <h1>Trending handmade finds</h1>
        <p>The products people are viewing, contacting makers about and liking most right now, one favourite from each artist.</p>
      </div>
      <section className="section">
        <Suspense fallback={<SectionLoader label="Loading trending finds…" variant="cards" />}>
          <TrendingGrid />
        </Suspense>
      </section>
    </>
  );
}
