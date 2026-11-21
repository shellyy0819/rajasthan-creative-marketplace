'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The logo link. Already on the home page (no query, no hash), a click only scrolls to the top: following the link would fetch the
 * page again and redraw all of it for nothing. Anywhere else, and for a click that means "open elsewhere" (Ctrl, Cmd, Shift, Alt, middle
 * button), it is an ordinary link to the home page. On the home page with a query or hash (?day=…, #workshops) it still goes to the
 * plain home page, which clears them.
 */
export function BrandLink({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Link className="brand" href="/" aria-label="Craftofy home" onClick={e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (pathname !== '/' || window.location.search || window.location.hash) return;
      e.preventDefault();
      const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }}>{children}</Link>
  );
}
