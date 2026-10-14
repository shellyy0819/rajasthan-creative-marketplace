import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <section className="page-head" style={{ paddingBottom: 80 }}>
      <span className="eyebrow">404</span>
      <h1>We couldn’t find that page.</h1>
      <p>It may have sold out, moved, or never existed.</p>
      <p><Link className="text-link" href="/shop">Browse handmade finds →</Link> · <Link className="text-link" href="/workshops">Find a workshop →</Link></p>
    </section>
  );
}
