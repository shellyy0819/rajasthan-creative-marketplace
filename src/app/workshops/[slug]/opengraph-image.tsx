import { notFound } from 'next/navigation';
import { getWorkshopBySlug } from '@/lib/catalog';
import { renderOg, ogSize } from '@/lib/og';

export const alt = 'Creative workshop in India';
export const size = ogSize;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const w = await getWorkshopBySlug((await params).slug);
  if (!w) notFound();
  return renderOg(w.title, `${w.date} · ${w.venue}, ${w.city}`);
}
