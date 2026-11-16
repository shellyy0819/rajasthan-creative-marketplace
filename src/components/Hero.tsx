import Link from 'next/link';
import { hasChalkboard } from '@/lib/themes/types';
import { NEUTRAL_WORDING, type CatalogWording } from '@/lib/catalog-wording';
import { DEFAULT_STALL, HeroStall, type StallProps } from './HeroStall';

export function Hero({ stall = DEFAULT_STALL, wording = NEUTRAL_WORDING }: { stall?: StallProps; wording?: CatalogWording }) {
  // "Handmade" is offered only while a sourcing type that counts as handmade has published products.
  const exploreLabel = wording.handmadeType ? 'Explore Handmade' : 'Explore the Shop';
  const exploreHref = wording.handmadeType ? `/shop?source=${encodeURIComponent(wording.handmadeType)}` : '/shop';
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">THE CREATIVE SIDE OF INDIA</span>
          <h1><span>Discover the Craft.</span> <span>Meet the Maker.</span> <span><em>Learn the Art.</em></span></h1>
          <p>Shop thoughtfully curated {wording.products} from India&apos;s independent artisans and book hands-on workshops to experience traditional crafts firsthand.</p>
          <div className="hero-actions">
            <Link className="button primary" href={exploreHref}>{exploreLabel} <span>↗</span></Link>
            <Link className="button outline" href="/workshops">Find a Workshop <span>↓</span></Link>
          </div>
          <div className="hero-proof"><span>✦ Independent makers</span><span>✦ Local experiences</span><span>✦ Made across India</span></div>
        </div>
        <div className="hero-art" {...(stall.chalkHref && hasChalkboard(stall) ? {} : { 'aria-hidden': true })}>
          <HeroStall {...stall} />
        </div>
      </section>
      <section className="intro">
        <span className="eyebrow">A MARKETPLACE WITH A LOCAL SOUL</span>
        <h2>Shop unique. <em>Support Craftpreneurs.</em></h2>
        <p>Discover one-of-a-kind {wording.finds} from independent Craftpreneurs, then explore creative workshops and experiences at your favourite local spots.</p>
      </section>
    </>
  );
}
