import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CatalogWording } from '@/lib/catalog-wording';
import { HeroStall } from './HeroStall';

/** "Handmade" is offered only while a sourcing type that counts as handmade has published products. */
export function ExploreLink({ wording }: { wording?: Pick<CatalogWording, 'handmadeType'> }) {
  const handmade = wording?.handmadeType;
  return <Link className="button primary" href={handmade ? `/shop?source=${encodeURIComponent(handmade)}` : '/shop'}>{handmade ? 'Explore Handmade' : 'Explore the Shop'} <span>↗</span></Link>;
}

/**
 * The hero is fixed markup, so it is in the first HTML and never waits on the database. The few parts that depend on data are
 * slots: each defaults to its plain version, and the page streams the real one in over it (the themed stall, the wording of the
 * supporting text, the explore button).
 */
export function Hero({ art = <HeroStall />, products = 'products', finds = 'finds', explore = <ExploreLink /> }: { art?: ReactNode; products?: ReactNode; finds?: ReactNode; explore?: ReactNode }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">THE CREATIVE SIDE OF INDIA</span>
          <h1><span>Discover the Craft.</span> <span>Meet the Maker.</span> <span><em>Learn the Art.</em></span></h1>
          <p>Shop thoughtfully curated {products} from India&apos;s independent artisans and book hands-on workshops to experience traditional crafts firsthand.</p>
          <div className="hero-actions">
            {explore}
            <Link className="button outline" href="/workshops">Find a Workshop <span>↓</span></Link>
          </div>
          <div className="hero-proof"><span>✦ Independent makers</span><span>✦ Local experiences</span><span>✦ Made across India</span></div>
        </div>
        <div className="hero-art">{art}</div>
      </section>
      <section className="intro">
        <span className="eyebrow">A MARKETPLACE WITH A LOCAL SOUL</span>
        <h2>Shop unique. <em>Support Craftpreneurs.</em></h2>
        <p>Discover one-of-a-kind {finds} from independent Craftpreneurs, then explore creative workshops and experiences at your favourite local spots.</p>
      </section>
    </>
  );
}
