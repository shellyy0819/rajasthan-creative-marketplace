'use client';
import { useEffect, useRef, useState } from 'react';
import { canResize, resizedSrcSet, resizedUrl } from '@/lib/photo-sizes';

/** `sizes` says how wide the photo is drawn, so the browser picks the smallest copy that is still sharp. */
export function ProductImage({ src, alt, fallback, eager = false, sizes = '(max-width: 700px) 92vw, 420px' }: { src?: string; alt: string; fallback: React.ReactNode; eager?: boolean; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  // Our own uploads are shown as resized copies; if that route cannot serve one, the original is used instead.
  const [resized, setResized] = useState(true);
  const small = !!src && resized && canResize(src);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // The browser can fail a URL (blocked, bad host) before React attaches onError during hydration;
  // an image that is already complete with zero width is broken.
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.complete) return;
    if (el.naturalWidth === 0) { if (small) setResized(false); else setFailed(true); }
    else setLoaded(true);
  }, [src, small]);
  if (!src || failed) return <>{fallback}</>;
  // Plain <img>: admin-supplied URLs can be on any host, so next/image remotePatterns can't be known up front.
  return (
    <>
      {!loaded && <span className="photo-shimmer" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={ref} className={`product-photo${loaded ? ' is-loaded' : ''}`} src={small ? resizedUrl(src, 960) : src} {...(small ? { srcSet: resizedSrcSet(src), sizes } : {})} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => { if (small) setResized(false); else setFailed(true); }} />
    </>
  );
}
