import Link from 'next/link';
import type { Metadata } from 'next';
import { Hero } from '@/components/Hero';
import { ProductGrid } from '@/components/ProductGrid';
import { WorkshopList } from '@/components/WorkshopList';
import { listProducts, listWorkshops, CITIES, citySlug } from '@/lib/catalog';
import { pageMetadata } from '@/lib/meta';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    path: '/',
  }),
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
};

export default async function Home() {
  const [products, workshops] = await Promise.all([listProducts(), listWorkshops()]);
  return (
    <>
      <Hero />
      <section className="section" id="shop" aria-labelledby="shop-h">
        <div className="section-heading">
          <div><span className="eyebrow">THE MAKERS&apos; SHELF</span><h2 id="shop-h">Handmade finds</h2></div>
          <Link className="text-link" href="/shop">Browse &amp; filter all →</Link>
        </div>
        <div style={{ height: 24 }} />
        <ProductGrid products={products} />
      </section>
      <section className="workshop-band" id="workshops" aria-labelledby="ws-h">
        <div className="workshop-intro">
          <span className="eyebrow">OUT OF THE SCROLL, INTO THE STUDIO</span>
          <h2 id="ws-h">Make time for<br /><em>making things.</em></h2>
          <p>Find friendly workshops, creative meetups and pop-up experiences hosted by local makers and venues.</p>
          <p><Link className="text-link" href="/workshops">Browse &amp; filter all →</Link></p>
        </div>
        <WorkshopList workshops={workshops} />
      </section>
      <section className="maker-cta">
        <div className="cta-flower" aria-hidden="true">✿</div>
        <div>
          <span className="eyebrow">YOUR HANDS MAKE SOMETHING SPECIAL?</span>
          <h2>There’s room for your craft here.</h2>
          <p>This demo shows the customer experience. Seller onboarding and listing approval will be added in the next build.</p>
        </div>
        <a className="button light" href={`mailto:${SITE.email}?subject=Marketplace%20seller%20interest`}>I’m a maker <span>↗</span></a>
      </section>
      <nav className="link-row" aria-label="Explore by city">
        {CITIES.map(c => <Link key={c} href={`/cities/${citySlug(c)}`}>Handmade &amp; workshops in {c}</Link>)}
      </nav>
    </>
  );
}
