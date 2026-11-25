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
      <Suspense fallback={null}><HomeWorkshops /></Suspense>
      <Suspense fallback={null}><TrendingWorkshopsSection /></Suspense>
      <section className="maker-cta" id="makers" aria-labelledby="makers-h">
        <div className="mc-awning" aria-hidden="true"><i /><b /></div>
        <div className="mc-body">
          <div className="mc-copy">
            <span className="eyebrow">YOUR CRAFT. YOUR BUSINESS. YOUR SPACE.</span>
            <h2 id="makers-h">You create. We connect. <em>You sell.</em></h2>
            <p className="mc-lead">We bring independent artists and customers together. Showcase your creations, reach more people, and grow your craft business while keeping control of your products, pricing, and earnings.</p>
            <Link className="button primary" href="/sell">List your craft <span aria-hidden="true">↗</span></Link>
          </div>
          <svg className="mc-art" viewBox="0 0 260 200" fill="none" aria-hidden="true">
            <rect x="16" y="168" width="228" height="8" rx="2" fill="var(--sand-line)" />
            <rect x="28" y="120" width="204" height="48" rx="3" fill="var(--stall-wood)" />
            <rect x="28" y="120" width="204" height="8" rx="2" fill="var(--stall-chalk)" opacity=".55" />
            <path d="M44 120c0-26 10-40 22-40s22 14 22 40z" fill="var(--clay)" />
            <rect x="56" y="70" width="20" height="12" rx="2" fill="var(--clay)" />
            <path d="M104 120c-6-10-6-30 0-44h30c6 14 6 34 0 44z" fill="var(--stall-indigo)" />
            <rect x="108" y="68" width="22" height="10" rx="2" fill="var(--stall-indigo)" />
            <path d="M156 120l-4-22h44l-4 22z" fill="var(--sage)" />
            <ellipse cx="174" cy="98" rx="22" ry="5" fill="var(--stall-mustard)" />
            <path d="M200 120c0-20 8-32 18-32s18 12 18 32z" fill="var(--stall-terra-d)" />
            <path d="M24 20h212v8H24z" fill="var(--sand-line)" opacity=".5" />
            <path d="M60 28v34M130 28v28M200 28v38" stroke="var(--sand-line)" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="60" cy="66" r="5" fill="var(--orange)" />
            <circle cx="130" cy="60" r="5" fill="var(--stall-mustard)" />
            <circle cx="200" cy="70" r="5" fill="var(--orange)" />
          </svg>
        </div>
      </section>
      {cities.length > 0 && (
        <nav className="link-row" aria-label="Explore by city">
          {cities.map(c => <Link key={c.slug} href={`/cities/${c.slug}`}>{capitalize(wording.finds)} &amp; workshops in {cityLabel(c)}</Link>)}
        </nav>
      )}
    </DataVersionProvider>
  );
}
