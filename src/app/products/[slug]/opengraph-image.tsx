import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/catalog';
import { money } from '@/lib/money';
import { renderOg, ogSize } from '@/lib/og';

export const alt = 'Handmade product from India';
export const size = ogSize;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProductBySlug((await params).slug);
  if (!p) notFound();
  return renderOg(p.name, `${money(p.pricePaise)} · by ${p.seller} · ${p.city}`);
}
