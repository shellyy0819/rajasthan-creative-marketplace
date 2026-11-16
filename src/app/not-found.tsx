import Link from 'next/link';
import type { Metadata } from 'next';
import { getCatalogWording } from '@/lib/catalog-wording';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } };

export default async function NotFound() {
  const wording = await getCatalogWording();
  return (
    <section className="page-head" style={{ paddingBottom: 80 }}>
      <span className="eyebrow">404</span>
      <h1>We couldn’t find that page.</h1>
      <p>It may have sold out, moved, or never existed.</p>
      <p><Link className="text-link" href="/shop">Browse {wording.finds} →</Link> · <Link className="text-link" href="/workshops">Find a workshop →</Link></p>
    </section>
  );
}
