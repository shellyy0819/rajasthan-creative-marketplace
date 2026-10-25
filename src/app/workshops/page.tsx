import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LiveCatalog } from '@/components/LiveCatalog';
import { JsonLd } from '@/components/JsonLd';
import { listWorkshops } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';
import { hasFilters, parseFilters } from '@/lib/filters';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  return pageMetadata({
    title: 'Creative workshops & pop-ups in India',
    description: 'Hands-on crochet, painting and maker meetups hosted by local studios and cafés across India. Free and paid.',
    path: '/workshops',
    noindex: hasFilters(f),
  });
}

export default async function WorkshopsPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const [workshops, cities] = await Promise.all([listWorkshops(f), listActiveCities()]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
        <h1>Creative workshops &amp; pop-ups</h1>
        <p>Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés.</p>
      </div>
      <LiveCatalog kind="workshops" initialItems={workshops} initialValues={f} cities={cities.map(c => ({ name: c.name, slug: c.slug }))} />
    </>
  );
}
