import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Hero } from '@/components/Hero';
import { HomeCraftExplorer } from '@/components/HomeCraftExplorer';
import { WorkshopList } from '@/components/WorkshopList';
import { TrendingSection } from '@/components/TrendingSection';
import { SectionLoader } from '@/components/SectionLoader';
import { SignedOutToast } from '@/components/SignedOutToast';
import { ValueProps } from '@/components/ValueProps';
import { listProducts, listWorkshops } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';
import { cityLabeller } from '@/lib/city-label';
import { pageMetadata } from '@/lib/meta';
import { SITE } from '@/lib/site';
import { getRenderTheme } from '@/lib/themes/render';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    path: '/',
    image: false,
  }),
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
};

async function HomeProducts() {
  return <HomeCraftExplorer products={await listProducts()} />;
}

async function HomeWorkshops() {
  return <WorkshopList workshops={await listWorkshops()} emptyMessage="No workshops are scheduled yet. Check back soon." />;
}

async function HomeCityLinks() {
  const cities = await listActiveCities();
  const cityLabel = cityLabeller(cities);
  if (cities.length === 0) return null;
  return (
    <nav className="link-row" aria-label="Explore by city">
      {cities.map(c => <Link key={c.slug} href={`/cities/${c.slug}`}>Handmade &amp; workshops in {cityLabel(c)}</Link>)}
    </nav>
  );
}

export default async function Home() {
  // Only the theme is awaited up front (the hero needs it); the lists stream in under their own headings.
  const theme = await getRenderTheme();
  const { sign, chalkLabel, chalkTitle, chalkSub, bunting, stickers } = theme.config;
  return (
    <>
      <SignedOutToast />
      <Hero stall={{ sign, chalkLabel, chalkTitle, chalkSub, bunting, stickers }} />
      <ValueProps />
      <Suspense fallback={null}><TrendingSection /></Suspense>
      <section className="section" id="shop" aria-labelledby="shop-h">
        <div className="section-heading">
          <div><span className="eyebrow">THE MAKERS&apos; SHELF</span><h2 id="shop-h">Handmade finds</h2></div>
          <Link className="text-link" href="/shop">Browse &amp; filter all →</Link>
        </div>
        <Suspense fallback={<SectionLoader label="Loading handmade finds…" variant="cards" />}><HomeProducts /></Suspense>
      </section>
      <section className="workshop-band" id="workshops" aria-labelledby="ws-h">
        <div className="workshop-intro">
          <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
          <h2 id="ws-h">Make time for<br /><em>making things.</em></h2>
          <p>Find friendly workshops, creative meetups and pop-up experiences hosted by local makers and venues.</p>
          <p><Link className="text-link" href="/workshops">Browse &amp; filter all →</Link></p>
        </div>
        <Suspense fallback={<SectionLoader label="Loading workshops…" variant="list" announce={false} />}><HomeWorkshops /></Suspense>
      </section>
      <section className="maker-cta" id="makers">
        <div className="cta-flower" aria-hidden="true">✿</div>
        <div>
          <span className="eyebrow">YOUR CRAFT. YOUR BUSINESS. YOUR SPACE.</span>
          <h2>You create. We connect. You sell.</h2>
          <p>We bring independent artists and customers together. Showcase your creations, reach more people, and grow your craft business while keeping control of your products, pricing, and earnings.</p>
        </div>
        <Link className="button light" href="/sell">List your craft <span>↗</span></Link>
      </section>
      <Suspense fallback={null}><HomeCityLinks /></Suspense>
    </>
  );
}
