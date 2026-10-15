'use client';
import { useState } from 'react';

export function ProductImage({ src, alt, fallback }: { src?: string; alt: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  // Plain <img>: admin-supplied URLs can be on any host, so next/image remotePatterns can't be known up front.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="product-photo" src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
