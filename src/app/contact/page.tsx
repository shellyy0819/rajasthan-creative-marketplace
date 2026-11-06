import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { contactEmail } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Contact us',
  description: 'Get in touch with the Craftofy team by email.',
  path: '/contact',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Contact us', path: '/contact' }];

export const dynamic = 'force-dynamic'; // read CONTACT_EMAIL when the page is served

export default function ContactPage() {
  const email = contactEmail();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="CONTACT US" title="Say hello." intro="Questions, ideas or feedback? We would love to hear from you.">
        <p>Write to us at <a className="text-link" href={`mailto:${email}`}>{email}</a>.</p>
      <p>You can also reach any maker directly from their page. <Link className="text-link" href="/help">See how it works →</Link></p>
    </InfoPage>
    </>
  );
}
