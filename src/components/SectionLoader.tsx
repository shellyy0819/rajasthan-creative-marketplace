/**
 * Inline loader for the part of a page that is still fetching. Render it as the Suspense fallback in place of the
 * dynamic content so the headings around it stay visible; never use it as a centred overlay (that is PageLoader).
 * "cards" uses the product grid and card proportions, "list" the workshop rows, "text" a few lines.
 */
export function SectionLoader({ label = 'Loading…', variant = 'cards', count }: { label?: string; variant?: 'list' | 'cards' | 'text'; count?: number }) {
  const n = count ?? (variant === 'cards' ? 4 : variant === 'list' ? 3 : 3);
  const items = Array.from({ length: n }, (_, i) => i);
  return (
    <div className={`rr-section-loader ${variant}`} role="status" aria-busy="true" aria-live="polite" data-variant={variant}>
      <div className="rr-section-loader-head">
        <span className="rr-spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {variant === 'cards' && (
        <div className="product-grid" aria-hidden="true">
          {items.map(i => (
            <div className="sk-card" key={i}>
              <div className="sk-visual" />
              <div className="sk-body"><span className="sk-line w40" /><span className="sk-line title w80" /><span className="sk-line" /><span className="sk-line w60" /></div>
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
            </div>
          ))}
        </div>
      )}
      {variant === 'text' && items.map(i => <span className="sk-line" key={i} aria-hidden="true" />)}
    </div>
  );
}
