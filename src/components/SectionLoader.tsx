/**
 * Inline loader for the part of a page that is still fetching. Render it as the Suspense fallback in place of the
 * dynamic content so the headings around it stay visible; never use it as a centred overlay (that is PageLoader).
 * "cards" uses the product grid and card proportions, "list" the workshop rows, "text" a few lines.
 * `withFilters` adds a placeholder the size of the LiveCatalog summary and filter bar (shop, workshops), so the
 * list does not jump down when the real filters appear.
 * Screen readers get ONE polite status line per loader; when several loaders show at once (home page) pass
 * `announce={false}` on all but the first. The visible spinner, label and skeletons are aria-hidden; aria-busy
 * marks the region being loaded.
 */
export function SectionLoader({ label = 'Loading…', variant = 'cards', count, withFilters = false, announce = true }: { label?: string; variant?: 'list' | 'cards' | 'text'; count?: number; withFilters?: boolean; announce?: boolean }) {
  const n = count ?? (variant === 'cards' ? 4 : 3);
  const items = Array.from({ length: n }, (_, i) => i);
  return (
    <div className={`rr-section-loader ${variant}`} aria-busy="true" data-variant={variant}>
      {announce && <span role="status" className="sr-only">{label}</span>}
      {withFilters && (
        <div className="sk-catalog-head" aria-hidden="true">
          <span className="sk-line w40" />
          <div className="sk-filters"><span className="sk-control sk-search" /><span className="sk-control" /><span className="sk-control" /></div>
        </div>
      )}
      <div className="rr-section-loader-head" aria-hidden="true">
        <span className="rr-spinner" />
        <span>{label}</span>
      </div>
      {variant === 'cards' && (
        <div className="product-grid" aria-hidden="true">
          {items.map(i => (
            <div className="sk-card" key={i}>
              <div className="sk-body"><span className="sk-line w40" /><span className="sk-line title w80" /><span className="sk-line w60" /></div>
            </div>
          ))}
        </div>
      )}
      {variant === 'list' && (
        <div className="workshop-list" aria-hidden="true">
          {items.map(i => (
            <div className="sk-row" key={i}>
              <div className="sk-tile" />
              <div className="sk-body flush"><span className="sk-line title w60" /><span className="sk-line w80" /><span className="sk-line w40" /></div>
              <span className="sk-control sk-price" />
            </div>
          ))}
        </div>
      )}
      {variant === 'text' && items.map(i => <span className="sk-line" key={i} aria-hidden="true" />)}
    </div>
  );
}
