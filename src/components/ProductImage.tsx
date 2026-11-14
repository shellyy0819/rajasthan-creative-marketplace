'use client';
import { useEffect, useRef, useState } from 'react';

export function ProductImage({ src, alt, fallback, eager = false }: { src?: string; alt: string; fallback: React.ReactNode; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // The browser can fail a URL (blocked, bad host) before React attaches onError during hydration;
  // an image that is already complete with zero width is broken.
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.complete) return;
    if (el.naturalWidth === 0) setFailed(true);
    else setLoaded(true);
  }, [src]);
  if (!src || failed) return <>{fallback}</>;
  // Plain <img>: admin-supplied URLs can be on any host, so next/image remotePatterns can't be known up front.
  return (
    <>
      {!loaded && <span className="photo-shimmer" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={ref} className={`product-photo${loaded ? ' is-loaded' : ''}`} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
    </>
  );
}
