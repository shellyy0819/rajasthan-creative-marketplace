/**
 * Shown while a route streams in. A thin indeterminate bar fixed at the very top of the viewport: it never
 * covers, dims or blocks the page (the headings and links stay usable); the data areas show their own
 * inline <SectionLoader />. The bar is styled in globals.css (.rr-route-bar) and honours prefers-reduced-motion.
 */
export default function Loading() {
  return (
    <div className="rr-route-bar" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <span aria-hidden="true" />
    </div>
  );
}
