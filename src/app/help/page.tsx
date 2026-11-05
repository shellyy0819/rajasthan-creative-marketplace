import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const metadata: Metadata = pageMetadata({
  title: 'How it works',
  description: 'Find a maker or workshop in your city, contact the artist directly and pay them directly. Craftofy does not take payments.',
  path: '/help',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'How it works', path: '/help' }];

export default function HelpPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="LET US HELP YOU" title="How Craftofy works." intro="Craftofy helps you find makers. The rest happens between you and the artist.">
        <ol>
          <li><b>Find.</b> Browse handmade finds and workshops, or pick your city.</li>
          <li><b>Connect.</b> Contact the artist directly using the details on their page.</li>
          <li><b>Buy or join.</b> Agree the details and pay the artist directly. Craftofy does not take payments.</li>
        </ol>
        {/* <h2>Cookies</h2>
        <p>We use analytics cookies only if you allow them. You can change your choice any time from “Cookie settings” in the footer.</p> */}
      </InfoPage>
    </>
  );
}
