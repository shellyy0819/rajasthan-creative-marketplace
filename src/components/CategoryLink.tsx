'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { gaCategoryClick } from '@/lib/ga-events';

/** A link to a category page that tells GA4 where it was clicked (`home` block or the `index` list). */
export function CategoryLink({ slug, source, children }: { slug: string; source: 'home' | 'index'; children: ReactNode }) {
  return <Link href={`/categories/${slug}`} onClick={() => gaCategoryClick(slug, source)}>{children}</Link>;
}
