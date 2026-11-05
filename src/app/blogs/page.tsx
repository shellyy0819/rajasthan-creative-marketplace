import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const metadata: Metadata = pageMetadata({
  title: 'Blogs',
  description: 'Stories from Craftofy makers and the crafts of India. Coming soon.',
  path: '/blogs',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Blogs', path: '/blogs' }];

export default function BlogsPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="BLOGS" title="Stories from the makers." intro="Maker stories, craft guides and workshop notes.">
        <p className="empty">Our first stories are coming soon.</p>
        <p><Link className="text-link" href="/shop">Browse handmade finds →</Link> · <Link className="text-link" href="/workshops">Find a workshop →</Link></p>
      </InfoPage>
    </>
  );
}
