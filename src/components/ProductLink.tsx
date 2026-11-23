'use client';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import { rememberPreview } from '@/lib/product-preview';

/** A link to a product page that first hands the card's own data to the page's loading screen, so the page opens with the real title, price and photo. */
export function ProductLink({ href, p, variant, children }: { href: string; p: Pick<Product, 'name' | 'category' | 'pricePaise' | 'imageUrl' | 'seller' | 'city'>; variant: number; children: React.ReactNode }) {
  const remember = () => rememberPreview(href, { name: p.name, category: p.category, pricePaise: p.pricePaise, imageUrl: p.imageUrl, seller: p.seller, city: p.city, variant });
  return <Link href={href} onPointerDown={remember} onClick={remember} onKeyDown={e => { if (e.key === 'Enter') remember(); }}>{children}</Link>;
}
