import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { WorkshopsEmptyState } from '@/components/WorkshopsEmptyState';
import { DataVersionProvider } from '@/components/DataVersion';
import { LiveCatalog } from '@/components/LiveCatalog';
import { JsonLd } from '@/components/JsonLd';
import { listWorkshops } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';
import { getDataVersion } from '@/lib/data-version';
import { hasFilters, parseFilters } from '@/lib/filters';
import { wantsHostForm } from '@/lib/host-link';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const f = parseFilters(sp);
  // With no workshop at all the page is empty content (a "soft 404" to search engines): keep it out of the index until one exists.
  const none = !hasFilters(f) && (await listWorkshops()).length === 0;
  return pageMetadata({
    title: 'Creative workshops & pop-ups in India',
    description: 'Hands-on crochet, painting and maker meetups hosted by local studios and cafés across India. Free and paid.',
    path: '/workshops',
    // The shared ?host=1 link is a way into the form, not a page of its own: its canonical stays /workshops and it is not indexed.
    noindex: hasFilters(f) || none || wantsHostForm(sp),
  });
}

export default async function WorkshopsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const [workshops, cities, version] = await Promise.all([listWorkshops(f), listActiveCities(), getDataVersion()]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }];
  return (
    <DataVersionProvider version={version}>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
        <h1>Creative workshops &amp; pop-ups</h1>
        <p>Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés.</p>
      </div>
      {workshops.length === 0 && !hasFilters(f) ? <WorkshopsEmptyState openHostForm={wantsHostForm(sp)} /> : <LiveCatalog kind="workshops" initialItems={workshops} initialValues={f} cities={cities.map(c => ({ name: c.name, slug: c.slug, state: c.state }))} />}
    </DataVersionProvider>
  );
}
