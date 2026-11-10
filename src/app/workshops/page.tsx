import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ComingSoonStall } from '@/components/ComingSoonStall';
import { LiveCatalog } from '@/components/LiveCatalog';
import { JsonLd } from '@/components/JsonLd';
import { listWorkshops } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';
import { hasFilters, parseFilters } from '@/lib/filters';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { hostWorkshopMailto } from '@/lib/host-workshop';
import { contactEmail } from '@/lib/site';

export const dynamic = 'force-dynamic'; // read CONTACT_EMAIL when served

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
  // Nothing scheduled anywhere yet (and no filter narrowing the list): show the coming-soon stall instead of an empty catalog.
  if (workshops.length === 0 && !hasFilters(f)) {
    const email = contactEmail();
    const HOST = hostWorkshopMailto(email);
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <Breadcrumbs items={crumbs} />
        <section className="hero coming-soon">
          <div className="hero-copy">
            <span className="eyebrow">WORKSHOPS &amp; POP-UPS · OPENING SOON</span>
            <h1><span>Workshops are</span> <span><em>coming soon.</em></span></h1>
            <p>Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés are on their way. We are lining up the first ones now.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/shop">Shop handmade meanwhile <span>↗</span></Link>
              <a className="button outline" href={HOST}>Host a workshop</a>
            </div>
            <p className="coming-soon-note">Write to <b>{email}</b> and we will let you know when the first workshop is announced.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <ComingSoonStall />
          </div>
        </section>
      </>
    );
  }
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
        <h1>Creative workshops &amp; pop-ups</h1>
        <p>Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés.</p>
      </div>
      <LiveCatalog kind="workshops" initialItems={workshops} initialValues={f} cities={cities.map(c => ({ name: c.name, slug: c.slug, state: c.state }))} />
    </>
  );
}
