import { Breadcrumbs } from '@/components/Breadcrumbs';

/**
 * Shown the moment the shop is opened, while the products load: the parts of the page that never depend on the data (breadcrumbs, the
 * eyebrow, the title and the intro) are there at once, and only the filters and the grid are placeholders. It uses the plain "products"
 * wording; if the site describes its products more specifically (for example "handmade products"), the page swaps that word in when it arrives.
 */
export default function ShopLoading() {
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }];
  return (
    <>
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">THE MAKERS&apos; SHELF</span>
        <h1>Products</h1>
        <p>Craftofy is an online marketplace for products from independent artisans across India. Browse by category or city, then contact the maker directly to order. Craftofy charges makers no commission.</p>
      </div>
      <section className="section" style={{ paddingTop: 10 }} aria-busy="true">
        <p className="sr-only" role="status">Loading products</p>
        <div className="skeleton skeleton-filters" aria-hidden="true" />
        <div className="product-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton skeleton-card" />)}
        </div>
      </section>
    </>
  );
}
