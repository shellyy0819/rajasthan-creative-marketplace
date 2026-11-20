import Link from 'next/link';

/** Previous / next links for a category page. Page 1 is the base address; later pages are `?page=N`. Nothing when there is only one page. */
export function CategoryPagination({ base, page, pages }: { base: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n <= 1 ? base : `${base}?page=${n}`);
  return (
    <nav className="cat-pages" aria-label="Pages">
      {page > 1 && <Link className="text-link" href={href(page - 1)} rel="prev">← Previous</Link>}
      <span className="cat-pages-count">Page {page} of {pages}</span>
      {page < pages && <Link className="text-link" href={href(page + 1)} rel="next">Next →</Link>}
    </nav>
  );
}
