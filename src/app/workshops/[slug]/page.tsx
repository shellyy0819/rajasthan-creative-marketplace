import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { Share } from '@/components/Share';
import { getWorkshopBySlug, workshopSlug } from '@/lib/catalog';
import { getWorkshopHostPhoto } from '@/lib/workshop-host';
import { breadcrumbJsonLd, workshopJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { money } from '@/lib/money';
import { isCurrent, summarizePrices } from '@/lib/workshop-listing';
import { ClassDetail } from '@/components/class/ClassDetail';
import { CraftDetail } from '@/components/class/CraftDetail';

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
  const ended = !isCurrent(w);
  const isClass = w.kind === 'class' || w.mode === 'online';
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Workshops', path: '/workshops' }, { name: w.title, path: `/workshops/${workshopSlug(w)}` }];
  const share = await Share({ path: `/workshops/${workshopSlug(w)}`, title: w.title, kind: 'workshop', by: w.host, subtitle: `${w.host} · ${isClass ? 'Online' : w.city}`, itemId: w.id, image: w.images[0] });
  return (
    <>
      <JsonLd data={[workshopJsonLd(w), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      {isClass ? <ClassDetail w={w} ended={ended} hostPhoto={await getWorkshopHostPhoto(w.id)} share={share} /> : <CraftDetail w={w} ended={ended} share={share} />}
    </>
  );
}
