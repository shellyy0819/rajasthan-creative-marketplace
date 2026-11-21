'use client';
import Link from 'next/link';
import { gaSelectWorkshop } from '@/lib/ga-events';

/** The title link of a workshop card: a normal link that also reports `select_item` (the whole card opens through it). */
export function WorkshopTitleLink({ href, workshopId, category, contentType, children }: { href: string; workshopId: string; category?: string; contentType: 'class' | 'workshop'; children: React.ReactNode }) {
  return <Link href={href} onClick={() => gaSelectWorkshop({ workshopId, category, contentType })}>{children}</Link>;
}
