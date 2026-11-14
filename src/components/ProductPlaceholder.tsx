/** The one picture shown wherever a product has no photo (or its photo fails to load). Never varies by product, category or page. */
export function ProductPlaceholder() {
  return (
    <span className="product-placeholder" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="9" width="36" height="30" rx="4" />
        <circle cx="17" cy="20" r="3" />
        <path d="M6 33l10-9 8 7 6-5 12 10" />
      </svg>
    </span>
  );
}
