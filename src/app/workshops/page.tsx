import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { WorkshopsEmptyState } from '@/components/WorkshopsEmptyState';
import { DataVersionProvider } from '@/components/DataVersion';
import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { LiveCatalog } from '@/components/LiveCatalog';
import { JsonLd } from '@/components/JsonLd';
import { listWorkshops } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';
import { getDataVersion } from '@/lib/data-version';
import { hasFilters, parseFilters } from '@/lib/filters';
import { hostPath, wantsHostForm } from '@/lib/host-link';
import { listActiveTopics } from '@/lib/topics';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { supportLine } from '@/lib/workshop-support';
import { contactEmail } from '@/lib/site';

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
  const [workshops, cities, version, topics] = await Promise.all([listWorkshops(f), listActiveCities(), getDataVersion(), listActiveTopics()]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }];
  return (
    <DataVersionProvider version={version}>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
        <h1>Creative workshops &amp; pop-ups</h1>
        <p>Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés.</p>
        <p className="ws-supports">{supportLine()}</p>
      </div>
      {workshops.length === 0 && !hasFilters(f)
        ? <WorkshopsEmptyState openHostForm={wantsHostForm(sp)} initialPath={hostPath(sp)} topics={topics} />
        : <>
            <LiveCatalog kind="workshops" initialItems={workshops} initialValues={f} cities={cities.map(c => ({ name: c.name, slug: c.slug, state: c.state }))} />
            {/* The footer's "Want to host a workshop?" link: with workshops listed there is no host button on the page, so this link brings its own. */}
            {wantsHostForm(sp) && <div className="host-more"><HostWorkshopButton contactEmail={contactEmail()} defaultOpen initialPath={hostPath(sp)} topics={topics} shareable /></div>}
          </>}
    </DataVersionProvider>
  );
}
