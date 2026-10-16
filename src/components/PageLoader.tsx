/**
 * Whole-page loader, centred on the screen. Use it for work that is not tied to one button
 * (refreshing a list, filtering, a row action). A busy *button* shows its own spinner instead:
 * set aria-busy={busy} (and disabled) on it, see globals.css.
 * `blocking` (default) dims the page and stops clicks; use blocking={false} for background fetches such as live search.
 */
export function PageLoader({ show, label = 'Loading…', blocking = true }: { show: boolean; label?: string; blocking?: boolean }) {
  if (!show) return null;
  return (
    <div className={`rr-page-loader${blocking ? ' blocking' : ''}`} role="status" aria-live="polite">
      <div className="rr-page-loader-box">
        <span className="rr-spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
