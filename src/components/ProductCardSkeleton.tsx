/**
 * A product card with nothing in it yet. It is built from the same classes and the same parts as ProductCard (photo, top row, title, maker
 * line, price row), so on laptops (a fixed 3 / 4 card) and on phones (photo on top, details panel with fixed line heights) it is exactly
 * the size of the real card and the page does not move when the products arrive. The words are only there to take up the lines.
 */
export function ProductCardSkeleton() {
  return (
    <article className="product-card product-card-skeleton" aria-hidden="true">
      <div className="product-visual skeleton" />
      <div className="pc-top">
        <span className="pc-chips"><span className="pc-chip skeleton">Category</span></span>
        <span className="like-btn skeleton" />
      </div>
      <div className="product-info">
        <h3><span className="skeleton sk">Product name</span></h3>
        <p className="pc-who"><span className="pc-av skeleton" /><span className="skeleton sk">Maker · City</span></p>
        <div className="product-bottom">
          <span className="price skeleton sk">₹0000</span>
          <span className="contact-btn contact-icon-btn skeleton" />
        </div>
      </div>
    </article>
  );
}

/** The grid of skeleton cards shown while a filter's first page loads. `count` is how many products the filter has (at most one page), so the grid is as long as the real one. */
export function ProductGridSkeleton({ count, label = 'Loading finds' }: { count: number; label?: string }) {
  return (
    <div className="product-grid" aria-busy="true">
      <p className="sr-only" role="status">{label}</p>
      {Array.from({ length: Math.max(1, count) }, (_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}
