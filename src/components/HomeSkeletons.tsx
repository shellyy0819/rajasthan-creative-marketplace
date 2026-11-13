/** Placeholders shown while a home-page section streams in: two cards per section, no overlay, so the hero stays usable. */
const TWO = [0, 1];

export function ProductSkeletons() {
  return (
    <div className="product-grid" role="status" aria-busy="true" aria-label="Loading products">
      {TWO.map(i => <div key={i} className="skeleton skeleton-card" aria-hidden="true" />)}
    </div>
  );
}

export function WorkshopSkeletons() {
  return (
    <div className="workshop-list" role="status" aria-busy="true" aria-label="Loading workshops">
      {TWO.map(i => <div key={i} className="skeleton skeleton-row" aria-hidden="true" />)}
    </div>
  );
}

/** The Trending row has no fixed heading until it knows something trends, so its placeholder carries a bar instead. */
export function TrendingSkeleton() {
  return (
    <section className="section" aria-hidden="true">
      <div className="section-heading"><div><span className="skeleton skeleton-line short" /><span className="skeleton skeleton-line title" /></div></div>
      <ProductSkeletons />
    </section>
  );
}

/** Whole-home placeholder for route transitions: the three data sections, headings included. */
export function HomeSkeleton() {
  return (
    <>
      <TrendingSkeleton />
      <section className="section">
        <div className="section-heading"><div><span className="skeleton skeleton-line short" /><span className="skeleton skeleton-line title" /></div></div>
        <ProductSkeletons />
      </section>
      <section className="workshop-band">
        <div className="workshop-intro"><span className="skeleton skeleton-line short" /><span className="skeleton skeleton-line title" /></div>
        <WorkshopSkeletons />
      </section>
    </>
  );
}
