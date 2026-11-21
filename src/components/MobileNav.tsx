'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import './MobileNav.css';

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Phones only: the menu links that do not fit in the top bar, behind a hamburger button that opens a drawer from the left.
 * The drawer is drawn on document.body, not inside the header, because the header's blur makes it the containing block of anything fixed inside it.
 * `fair`: on very narrow phones the Fair pill does not fit beside the logo and the login button, so the drawer carries it there (CSS shows it only below 430px).
 * It closes on Escape, on the backdrop, on any link, and when the page changes; focus is kept inside while it is open and returns to the button.
 */
export function MobileNav({ dashboardUrl = '', fair = false }: { dashboardUrl?: string; fair?: boolean }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const role = session?.user?.role;
  const posts = `${dashboardUrl}/dashboard/posts`;

  const close = () => { setOpen(false); button.current?.focus(); };
  useEffect(() => { setOpen(false); }, [pathname]); // the new page has arrived
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia('(min-width: 601px)');
    const onWide = () => { if (wide.matches) setOpen(false); }; // rotated or resized past the phone layout: the top bar shows the links itself
    wide.addEventListener('change', onWide);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); return; }
      if (e.key !== 'Tab') return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => { wide.removeEventListener('change', onWide); document.removeEventListener('keydown', onKey); document.body.style.overflow = was; };
  }, [open]);

  return (
    <>
      <button ref={button} type="button" className="theme-toggle mobile-nav-btn" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-drawer" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && createPortal(
        <>
          <div className="mobile-drawer-backdrop" onClick={close} aria-hidden="true" />
          <div ref={panel} id="mobile-drawer" className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="mobile-drawer-head">
              <span className="mobile-drawer-title">Menu</span>
              <button type="button" className="theme-toggle" aria-label="Close menu" onClick={close}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <nav className="mobile-drawer-nav" aria-label="Menu">
              <Link href="/shop" onClick={() => setOpen(false)}>Shop products</Link>
              <Link href="/workshops" onClick={() => setOpen(false)}>Workshops &amp; pop-ups</Link>
              {fair && <Link href="/fair" className="mobile-drawer-fair" onClick={() => setOpen(false)}>Fair<span className="nav-fair-spark" aria-hidden="true" /></Link>}
              {role === 'admin' && <Link href={posts} onClick={() => setOpen(false)}>Admin</Link>}
              {role === 'seller' && <Link href={posts} onClick={() => setOpen(false)}>My products</Link>}
            </nav>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
