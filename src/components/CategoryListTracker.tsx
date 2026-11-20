'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { gaSelectItem, gaViewCategoryList } from '@/lib/ga-events';

/**
 * Wraps a category page's product list. Tells GA4 the list was shown (once per page) and which product was opened from it (`select_item`).
 * One click handler for the whole list: a click on a product link finds its card's `data-product-id`.
 */
export function CategoryListTracker({ slug, page, children }: { slug: string; page: number; children: ReactNode }) {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const key = `${slug}:${page}`;
    if (seen.current === key) return;     // strict mode runs effects twice
    seen.current = key;
    gaViewCategoryList(slug, page);
  }, [slug, page]);
  return (
    <div onClick={e => {
      const link = (e.target as Element).closest?.('a[href^="/products/"]');
      const id = link?.closest('[data-product-id]')?.getAttribute('data-product-id');
      if (id) gaSelectItem(id, slug);
    }}>{children}</div>
  );
}
