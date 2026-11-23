import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ExploreLink, Hero } from '@/components/Hero';
import { HeroStall } from '@/components/HeroStall';
import { HomeShelf } from '@/components/HomeShelf';
import { DataVersionProvider } from '@/components/DataVersion';
import { HomeWorkshops } from '@/components/HomeWorkshops';
import { TrendingSection } from '@/components/TrendingSection';
import { TrendingWorkshopsSection } from '@/components/TrendingWorkshopsSection';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ShopByCategory } from '@/components/ShopByCategory';
import { SignedOutToast } from '@/components/SignedOutToast';
import { ValueProps } from '@/components/ValueProps';
import { capitalize, getCatalogWording, siteCopy } from '@/lib/catalog-wording';
import { listActiveCitiesCached } from '@/lib/cities';
import { getDataVersion } from '@/lib/data-version';
import { cityLabeller } from '@/lib/city-label';
import { pageMetadata } from '@/lib/meta';
import { SITE } from '@/lib/site';
import { getRenderTheme } from '@/lib/themes/render';
import { artOf } from '@/lib/themes/presets';
import { hasChalkboard } from '@/lib/themes/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const copy = siteCopy(await getCatalogWording());
  return {
    ...pageMetadata({
      title: `${SITE.name} — ${copy.tagline}`,
      description: copy.description,
      path: '/',
      image: false,
    }),
    title: { absolute: `${SITE.name} — ${copy.tagline}` },
  };
}

/** The stall's themed parts (sign, bunting, chalkboard, stickers). Streams in over the plain stall, which is already on screen. */
async function ThemedStall() {
  const theme = await getRenderTheme();
  const { sign, chalkLabel, chalkTitle, chalkSub, chalkHref, bunting, stickers } = theme.config;
  return <HeroStall {...{ sign, chalkLabel, chalkTitle, chalkSub, ...(hasChalkboard(theme.config) ? { chalkHref: chalkHref ?? '/shop' } : {}), bunting, stickers }} art={artOf(theme.preset)} />;
}

/** The few hero words that depend on what is on sale. Each streams in over its plain default; getCatalogWording is cached, so these share one lookup. */
async function WordingProducts() { return (await getCatalogWording()).products; }
async function WordingFinds() { return (await getCatalogWording()).finds; }
async function WordingExplore() { return <ExploreLink wording={await getCatalogWording()} />; }

// The hero is fixed markup and a plain stall, so it is in the first HTML. Everything that reads the database streams in below it.
export default function Home() {
  return (
    <>
      <SignedOutToast />
      <Hero
        art={<Suspense fallback={<HeroStall />}><ThemedStall /></Suspense>}
        products={<Suspense fallback="products"><WordingProducts /></Suspense>}
        finds={<Suspense fallback="finds"><WordingFinds /></Suspense>}
        explore={<Suspense fallback={<ExploreLink />}><WordingExplore /></Suspense>}
      />
      <Suspense fallback={null}><HomeSections /></Suspense>
      <ScrollToTop />
    </>
  );
}

async function HomeSections() {
  const [cities, version, wording] = await Promise.all([listActiveCitiesCached(), getDataVersion(), getCatalogWording()]);
  const cityLabel = cityLabeller(cities);
  return (
    <DataVersionProvider version={version}>
      <ValueProps wording={wording} />
      <Suspense fallback={null}><TrendingSection /></Suspense>
      <section className="section" id="shop" aria-labelledby="shop-h">
        <div className="section-heading">
          <div><span className="eyebrow">THE MAKERS&apos; SHELF</span><h2 id="shop-h">Finds</h2></div>
          <Link className="text-link" href="/shop">Browse &amp; filter all →</Link>
        </div>
        <Suspense fallback={null}><HomeShelf /></Suspense>
      </section>
      <Suspense fallback={null}><ShopByCategory /></Suspense>
      <section className="workshop-band" id="workshops" aria-labelledby="ws-h">
        <div className="workshop-intro">
          <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
          <h2 id="ws-h">Make time for<br /><em>making things.</em></h2>
          <p>Find friendly workshops, creative meetups and pop-up experiences hosted by local makers and venues.</p>
          <p><Link className="text-link" href="/workshops">Browse &amp; filter all →</Link></p>
        </div>
        <Suspense fallback={null}><HomeWorkshops /></Suspense>
      </section>
      <Suspense fallback={null}><TrendingWorkshopsSection /></Suspense>
      <section className="maker-cta" id="makers">
        <div className="cta-flower" aria-hidden="true">✿</div>
        <div>
          <span className="eyebrow">YOUR CRAFT. YOUR BUSINESS. YOUR SPACE.</span>
          <h2>You create. We connect. You sell.</h2>
          <p>We bring independent artists and customers together. Showcase your creations, reach more people, and grow your craft business while keeping control of your products, pricing, and earnings.</p>
        </div>
        <Link className="button light" href="/sell">List your craft <span>↗</span></Link>
      </section>
      {cities.length > 0 && (
        <nav className="link-row" aria-label="Explore by city">
          {cities.map(c => <Link key={c.slug} href={`/cities/${c.slug}`}>{capitalize(wording.finds)} &amp; workshops in {cityLabel(c)}</Link>)}
        </nav>
      )}
    </DataVersionProvider>
  );
}
