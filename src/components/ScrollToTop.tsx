'use client';
import { useEffect, useState } from 'react';

/** A small "back to top" button that appears once the visitor has scrolled to the end of the page. */
export function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => {
      const el = document.documentElement;
      // Within one screen-height-ish of the bottom, and only on pages that are actually long.
      const atEnd = window.scrollY + window.innerHeight >= el.scrollHeight - 240;
      setShow(atEnd && el.scrollHeight > window.innerHeight * 1.5);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);
  const up = () => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  };
  return (
    <button type="button" className={`scroll-top${show ? ' show' : ''}`} aria-label="Back to top" title="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show} onClick={up}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}
