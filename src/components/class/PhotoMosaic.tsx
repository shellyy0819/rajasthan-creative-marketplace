'use client';
import { useRef, useState } from 'react';
import { PhotoViewer } from '../PhotoButton';

/**
 * The seller's photos at the top of a class page: the cover large, the other two smaller (one or two photos degrade gracefully).
 * On phones it is a swipeable strip with dots. Every photo opens the full-size viewer.
 */
export function PhotoMosaic({ images, title }: { images: string[]; title: string }) {
  const shown = images.slice(0, 3);
  const n = shown.length;
  const [open, setOpen] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = strip.current;
    if (!el || n < 2) return;
    const slide = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? el.clientWidth;
    setAt(Math.min(n - 1, Math.max(0, Math.round(el.scrollLeft / (slide + 8)))));
  };
  return (
    <div className="cd-media">
      <div ref={strip} className={`cd-mosaic cd-mosaic-${n}`} onScroll={onScroll}>
        {shown.map((src, i) => (
          <button key={src + i} type="button" className={`cd-tile${i === 0 ? ' cd-cover' : ''}`} aria-label={i === 0 ? `Open photo 1 of ${n}, the cover` : `Open photo ${i + 1} of ${n}`} onClick={() => setOpen(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${title}, photo ${i + 1} of ${n}`} loading={i === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" />
            {i === 0 && n > 1 && <span className="cd-chip" aria-hidden="true">Cover · view all {n} photos</span>}
          </button>
        ))}
      </div>
      {n > 1 && <div className="cd-dots" aria-hidden="true">{shown.map((_, i) => <span key={i} className={i === at ? 'on' : undefined} />)}</div>}
      {open !== null && <PhotoViewer images={shown} start={open} label={title} onClose={() => setOpen(null)} />}
    </div>
  );
}
