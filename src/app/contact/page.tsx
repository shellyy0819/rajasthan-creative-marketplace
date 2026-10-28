import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const metadata: Metadata = pageMetadata({
  title: 'Contact us',
  description: 'Get in touch with the Craftology team. Contact details coming soon.',
  path: '/contact',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Contact us', path: '/contact' }];

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="CONTACT US" title="Say hello." intro="Questions, ideas or feedback? We would love to hear from you.">
        <p className="empty">Our contact details are coming soon.</p>
      <p>In the meantime, you can reach any maker directly from their page. <Link className="text-link" href="/help">See how it works →</Link></p>
    </InfoPage>
    </>
  );
}
