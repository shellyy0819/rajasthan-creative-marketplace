import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { SITE } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Contact us',
  description: 'Get in touch with the Craftology team, or tell us you are a maker.',
  path: '/contact',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'Contact us', path: '/contact' }];

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="CONTACT US" title="Say hello." intro="Questions, ideas or feedback? We would love to hear from you.">
        <h2>Email</h2>
        <p><a className="text-link" href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
        <h2>Are you a maker?</h2>
        <p>Tell us about your craft and we will help you get listed. <a className="text-link" href={`mailto:${SITE.email}?subject=Marketplace%20seller%20interest`}>Email us →</a></p>
      </InfoPage>
    </>
  );
}
