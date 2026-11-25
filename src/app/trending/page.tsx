import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { TrendsBlock } from '@/components/trends/TrendsBlock';
import { WorkshopList } from '@/components/WorkshopList';
import { capitalize, getCatalogWording } from '@/lib/catalog-wording';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { SITE } from '@/lib/site';
import { getTrendsForPage, type TrendsForPage } from '@/lib/trend-preview';
import { trending } from '@/lib/trending';
import { PAGE_WORKSHOPS, trendingWorkshops } from '@/lib/trending-workshops';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const w = await getCatalogWording();
  return pageMetadata({
    title: `Trending ${w.finds}`,
    description: `The ${w.products} people are loving this week, one favourite from each artist.`,
    path: '/trending',
  });
}

export default async function TrendingPage() {
  const wording = await getCatalogWording();
  const workshops = await trendingWorkshops({ limit: PAGE_WORKSHOPS });
  // The market trends block is optional: if it cannot be loaded the page is what it was before it.
  let trends: TrendsForPage | null = null;
  try { trends = await getTrendsForPage(); } catch (e) { console.error('Market trends block failed to load', e); }
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Trending', path: '/trending' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">LOVED THIS WEEK</span>
        <h1>Trending {wording.finds}</h1>
        <p>The products people are viewing, contacting makers about and liking most right now, one favourite from each artist.</p>
      </div>
      {trends && <TrendsBlock data={trends} />}
      <section className="section" aria-labelledby={trends ? 'trending-picks-h' : undefined}>
        {trends && <div className="section-heading"><div><h2 id="trending-picks-h">{SITE.name} picks</h2></div></div>}
        <ProductGrid products={await trending({ limit: 24 })} emptyMessage="Nothing is trending yet. Like a product to start the trend." />
      </section>
      {workshops.length > 0 && (
        <section className="section" id="workshops" aria-labelledby="trending-ws-h">
          <div className="section-heading">
            <div><span className="eyebrow">POPULAR THIS WEEK</span><h2 id="trending-ws-h">Trending workshops</h2></div>
          </div>
          <p className="muted" style={{ margin: '0 0 16px' }}>The workshops and classes people are viewing, contacting the host about and reserving most right now, one favourite from each host.</p>
          <WorkshopList workshops={workshops} />
        </section>
      )}
    </>
  );
}
