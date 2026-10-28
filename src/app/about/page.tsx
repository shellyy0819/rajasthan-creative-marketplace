import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const metadata: Metadata = pageMetadata({
  title: 'About us',
  description: 'Craftology helps you find independent makers in your own city and deal with them directly. No middleman, no commission.',
  path: '/about',
});

const crumbs = [{ name: 'Home', path: '/' }, { name: 'About us', path: '/about' }];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <InfoPage eyebrow="ABOUT US" title="Your city’s makers, within reach." intro="Craftology is a place to find independent makers and creative workshops near you, and to deal with them directly.">
        <h2>Why we exist</h2>
        <p>Great handmade work is often made a few streets away, yet hard to find. We put makers and the people who love their work in the same place, so buying and learning feels personal again.</p>
        <h2>How we are different</h2>
        <ul>
          <li><b>Direct.</b> You talk to the maker yourself. We don’t sit in the middle.</li>
          <li><b>No commission.</b> Makers keep what they earn, so prices stay fair.</li>
          <li><b>Local first.</b> We start in Rajasthan and are growing city by city across India.</li>
        </ul>
      </InfoPage>
    </>
  );
}
