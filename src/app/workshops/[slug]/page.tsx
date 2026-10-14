import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ReserveButton } from '@/components/ReserveButton';
import { citySlug, getWorkshopBySlug, listWorkshops, workshopSlug } from '@/lib/catalog';
import { formatDay } from '@/lib/format';
import { breadcrumbJsonLd, workshopJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { money } from '@/lib/money';

export const dynamicParams = false;
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await listWorkshops()).map(w => ({ slug: workshopSlug(w) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = await getWorkshopBySlug((await params).slug);
  if (!w) return { title: 'Workshop not found', robots: { index: false } };
  return pageMetadata({
    title: `${w.title} — workshop in ${w.city}`,
    description: `${w.description} ${w.date} at ${w.venue}, ${w.city}. Hosted by ${w.host}. ${w.type === 'FREE' ? 'Free' : money(w.pricePaise)}.`,
    path: `/workshops/${workshopSlug(w)}`,
    image: false,
  });
}

export default async function WorkshopPage({ params }: Props) {
  const w = await getWorkshopBySlug((await params).slug);
  if (!w) notFound();
  const { day, month, year } = formatDay(w.date);
  const left = w.seats - w.booked;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }, { name: w.title, path: `/workshops/${workshopSlug(w)}` }];
  return (
    <>
      <JsonLd data={[workshopJsonLd(w), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <article className="detail">
        <div className="detail-art" style={{ background: '#d7dfd1', display: 'grid', placeItems: 'center' }} aria-hidden="true">
          <div className="date-tile" style={{ background: 'transparent' }}><b style={{ fontSize: 96 }}>{day}</b><span style={{ fontSize: 14 }}>{month} · {w.city}</span></div>
        </div>
        <div>
          <span className="product-meta">{w.type === 'FREE' ? 'Free meetup' : 'Workshop'}</span>
          <h1>{w.title}</h1>
          <p className="lead">{w.description}</p>
          <dl>
            <dt>When</dt><dd><time dateTime={`${w.date}T${w.time}+05:30`}>{day} {month} {year}, {w.time}</time></dd>
            <dt>Where</dt><dd>{w.venue}, <Link href={`/cities/${citySlug(w.city)}`}>{w.city}</Link></dd>
            <dt>Host</dt><dd>{w.host}</dd>
            <dt>Seats left</dt><dd>{left > 0 ? `${left} of ${w.seats}` : 'Full'}</dd>
            <dt>Price</dt><dd>{w.type === 'FREE' ? 'Free' : money(w.pricePaise)}</dd>
          </dl>
          <div className="workshop-price" style={{ textAlign: 'left' }}><ReserveButton workshop={w} /></div>
          <p className="fine-print" style={{ textAlign: 'left' }}>Demo booking only. Paid workshops do not collect payment.</p>
        </div>
      </article>
    </>
  );
}
