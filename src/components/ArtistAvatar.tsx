'use client';
import { useEffect, useRef, useState } from 'react';

/** The artist's round avatar: their uploaded logo, or the initial when there is none or it cannot be loaded. */
export function ArtistAvatar({ src, initial }: { src?: string; initial: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // The browser can fail a URL before React attaches onError during hydration; a complete image with zero width is broken.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (!src || failed) return <>{initial}</>;
  // Plain <img>: the logo lives on the storage host, which next/image remotePatterns cannot know up front. Above the fold, so not lazy.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} className="ah-logo" src={src} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
