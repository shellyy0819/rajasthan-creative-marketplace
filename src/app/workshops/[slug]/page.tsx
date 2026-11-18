import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ReserveButton } from '@/components/ReserveButton';
import { getWorkshopBySlug, workshopSlug } from '@/lib/catalog';
import { formatDay } from '@/lib/format';
import { breadcrumbJsonLd, workshopJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { money } from '@/lib/money';
import { describeSchedule, isCurrent, summarizePrices } from '@/lib/workshop-listing';
import { LEVEL_LABEL } from '@/lib/workshop-support';
import { WorkshopContact } from '@/components/WorkshopContact';
import '@/components/WorkshopListings.css';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = await getWorkshopBySlug((await params).slug);
  if (!w) return { title: 'Workshop not found', robots: { index: false } };
  const online = w.kind === 'class' || w.mode === 'online';
  const price = w.prices.length ? summarizePrices(w.prices).from : w.type === 'FREE' ? 'Free' : money(w.pricePaise);
  return pageMetadata({
    title: online ? `${w.title} — online class` : `${w.title} — workshop in ${w.city}`,
    description: online
      ? `${w.description} Online${w.platform ? ` on ${w.platform}` : ''}. Hosted by ${w.host}. ${price}.`
      : `${w.description} ${w.date} at ${w.venue}, ${w.city}. Hosted by ${w.host}. ${price}.`,
    path: `/workshops/${workshopSlug(w)}`,
    image: false,
    // An ended event keeps its page for people who hold the link, but it is not something to find in search.
    noindex: !isCurrent(w),
  });
}

export default async function WorkshopPage({ params }: Props) {
  const w = await getWorkshopBySlug((await params).slug);
  if (!w) notFound();
  const { day, month, year } = formatDay(w.date);
  const ended = !isCurrent(w);
  const isClass = w.kind === 'class' || w.mode === 'online';
  const bookable = !ended && !isClass && w.seats !== null;
  const left = (w.seats ?? 0) - w.booked;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }, { name: w.title, path: `/workshops/${workshopSlug(w)}` }];
  return (
    <>
      <JsonLd data={[workshopJsonLd(w), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <article className="detail">
        <div className="detail-art" style={{ background: '#d7dfd1', display: 'grid', placeItems: 'center' }} aria-hidden="true">
          <div className="date-tile" style={{ background: 'transparent' }}>
            {isClass ? <><b style={{ fontSize: 64 }}>Online</b><span style={{ fontSize: 14 }}>{w.platform}</span></> : <><b style={{ fontSize: 96 }}>{day}</b><span style={{ fontSize: 14 }}>{month} · {w.city}</span></>}
          </div>
        </div>
        <div>
          <span className="product-meta">{isClass ? 'Online class' : w.type === 'FREE' ? 'Free meetup' : 'Workshop'}</span>
          <h1>{w.title}</h1>
          {ended && <p className="ws-ended" role="status">This event has ended. <Link href="/workshops">See upcoming workshops</Link></p>}
          <p className="lead">{w.description}</p>
          <dl>
            <dt>When</dt>
            <dd>{isClass
              ? <>{w.schedule ? describeSchedule(w.schedule) : 'Online class'}, from {day} {month} {year}</>
              : <time dateTime={`${w.date}T${w.time}+05:30`}>{day} {month} {year}, {w.time}</time>}</dd>
            <dt>Where</dt>
            <dd>{w.mode === 'online' ? `Online${w.platform ? ` on ${w.platform}` : ''}` : <>{w.venue}, <Link href={`/cities/${w.citySlug}`}>{w.city}</Link></>}</dd>
            <dt>Host</dt><dd>{w.host}</dd>
            {w.level && <><dt>Level</dt><dd>{LEVEL_LABEL[w.level]}</dd></>}
            {w.languages.length > 0 && <><dt>Languages</dt><dd>{w.languages.join(', ')}</dd></>}
            {w.experience && <><dt>Experience</dt><dd>{w.experience}</dd></>}
            {w.certifications && <><dt>Certifications</dt><dd>{w.certifications}</dd></>}
            {w.seats !== null && !isClass && <><dt>Seats left</dt><dd>{left > 0 ? `${left} of ${w.seats}` : 'Full'}</dd></>}
            <dt>Price</dt>
            <dd>{w.prices.length ? summarizePrices(w.prices).all.map(p => <div key={p}>{p}</div>) : w.type === 'FREE' ? 'Free' : money(w.pricePaise)}</dd>
            {w.freeTrial && <><dt>Free trial</dt><dd>{w.freeTrialDays ? `${w.freeTrialDays}-day free trial class available` : 'Free trial class available'}</dd></>}
          </dl>
          {bookable ? <div className="workshop-price" style={{ textAlign: 'left' }}><ReserveButton workshop={w} /></div> : !ended && <div className="workshop-price" style={{ textAlign: 'left' }}><WorkshopContact w={w} /></div>}
          <p className="fine-print" style={{ textAlign: 'left' }}>No payment is collected on Craftofy.</p>
        </div>
      </article>
    </>
  );
}
