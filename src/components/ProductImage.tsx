'use client';
import { useEffect, useRef, useState } from 'react';

export function ProductImage({ src, alt, fallback }: { src?: string; alt: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // The browser can fail a URL (blocked, bad host) before React attaches onError during hydration;
  // an image that is already complete with zero width is broken.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (!src || failed) return <>{fallback}</>;
  // Plain <img>: admin-supplied URLs can be on any host, so next/image remotePatterns can't be known up front.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} className="product-photo" src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
