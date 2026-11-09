'use client';
import { useEffect, useRef, useState } from 'react';
import { ProductImage } from './ProductImage';

const ZOOM = 2.5;
/** Fade length in ms; keep in step with `.gallery-slide` in globals.css. */
export const SLIDE_MS = 350;
/** A swipe needs at least this much horizontal travel and must be clearly more horizontal than vertical. */
export const SWIPE_MIN_PX = 40;
export const SWIPE_RATIO = 1.5;
type Zoom = { lx: number; ly: number; lw: number; lh: number; pw: number; ph: number; bw: number; bh: number; bx: number; by: number };

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Product page photos: a carousel (arrows, dots, counter, swipe, arrow keys) when there is more than one photo,
 * a thumbnail row kept in sync, and the Amazon-style hover zoom on the current photo for mouse users.
 */
export function ProductGallery({ images, alt, fallback, variant = 0 }: { images: string[]; alt: string; fallback: React.ReactNode; variant?: number }) {
  const n = images.length;
  const many = n > 1;
  const [index, setIndex] = useState(0);
  const cur = Math.min(index, Math.max(n - 1, 0));
  const current = images[cur];
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const pointers = useRef(new Set<number>());
  const pinched = useRef(false);
  const first = useRef(true);

  const go = (i: number) => { if (n > 0) setIndex(((i % n) + n) % n); };

  // Slide change: hide the zoom while the fade runs, remember the photo as loaded, keep the thumbnail in view.
  useEffect(() => {
    setZoom(null);
    if (first.current) { first.current = false; return; }
    const row = strip.current, thumb = row?.children[cur] as HTMLElement | undefined;
    if (row && thumb) {
      const r = row.getBoundingClientRect(), t = thumb.getBoundingClientRect(); // relative to the row, whatever its offset parent is
      row.scrollLeft = row.scrollLeft + (t.left - r.left) - (row.clientWidth - t.width) / 2;
    }
    if (reducedMotion()) return;
    setMoving(true);
    const t = setTimeout(() => setMoving(false), SLIDE_MS);
    return () => clearTimeout(t);
  }, [cur]);

  // Hover zoom: a lens follows the mouse over the photo and a magnified pane opens beside it.
  // The photo is letterboxed (object-fit: contain), so the lens is kept inside the picture itself, not the frame.
  const zoomAt = (el: HTMLElement, img: HTMLImageElement, cx: number, cy: number) => {
    const r = el.getBoundingClientRect();
    const fit = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const w = img.naturalWidth * fit, h = img.naturalHeight * fit, ox = (r.width - w) / 2, oy = (r.height - h) / 2;
    const x = cx - r.left, y = cy - r.top;
    if (x < ox || x > ox + w || y < oy || y > oy + h) return setZoom(null);
    const lw = Math.min(r.width / ZOOM, w), lh = Math.min(r.height / ZOOM, h);
    const lx = Math.min(Math.max(x - lw / 2, ox), ox + w - lw), ly = Math.min(Math.max(y - lh / 2, oy), oy + h - lh);
    setZoom({ lx, ly, lw, lh, pw: lw * ZOOM, ph: lh * ZOOM, bw: w * ZOOM, bh: h * ZOOM, bx: (lx - ox) * ZOOM, by: (ly - oy) * ZOOM });
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !current || moving) return setZoom(null);
    if ((e.target as HTMLElement).closest('.gallery-arrow, .gallery-dots')) return setZoom(null);
    const el = box.current, img = el?.querySelector<HTMLImageElement>('.gallery-slide[data-active="true"] img.product-photo');
    if (!el || !img || !img.naturalWidth) return setZoom(null);
    zoomAt(el, img, e.clientX, e.clientY);
  };

  // One photo: exactly the original behaviour (any mouse event, lazy image, no slide wrapper).
  const onMoveSingle = (e: React.MouseEvent) => {
    const el = box.current, img = el?.querySelector<HTMLImageElement>('img.product-photo');
    if (!el || !img || !img.naturalWidth) return setZoom(null);
    zoomAt(el, img, e.clientX, e.clientY);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!many || e.pointerType === 'mouse' || (e.target as HTMLElement).closest('.gallery-arrow, .gallery-dots')) return;
    pointers.current.add(e.pointerId);
    // a second finger is a pinch, never a swipe
    if (pointers.current.size > 1) { pinched.current = true; start.current = null; return; }
    pinched.current = false;
    start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onCancel = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); start.current = null; };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const s = start.current; start.current = null;
    if (!s || s.id !== e.pointerId || pinched.current) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO) go(cur + (dx < 0 ? 1 : -1));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!many) return;
    const to = e.key === 'ArrowRight' ? cur + 1 : e.key === 'ArrowLeft' ? cur - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (to === null) return;
    e.preventDefault(); go(to);
  };

  // Every slide is mounted (hidden ones still lay out, so the browser fetches them lazily in the background);
  // only the current and neighbouring photos are eager.
  const near = (i: number) => i === cur || i === (cur + 1) % n || i === (cur - 1 + n) % n;
  const carousel = many ? { role: 'group', 'aria-roledescription': 'carousel', 'aria-label': 'Product photos', tabIndex: 0, onKeyDown: onKey, onPointerDown: onDown, onPointerUp: onUp, onPointerCancel: onCancel } : {};

  if (!many) {
    return (
      <div className="gallery">
        <div ref={box} className={`product-visual detail-art visual-${variant % 4}${current ? ' zoomable' : ''}`} onMouseMove={current ? onMoveSingle : undefined} onMouseLeave={() => setZoom(null)}>
          <ProductImage key={current ?? 'none'} src={current} alt={alt} fallback={fallback} />
          {zoom && <span className="zoom-lens" aria-hidden="true" style={{ left: zoom.lx, top: zoom.ly, width: zoom.lw, height: zoom.lh }} />}
        </div>
        {zoom && current && (
          <div className="zoom-pane" aria-hidden="true" style={{ width: zoom.pw, height: zoom.ph, backgroundImage: `url("${current.replace(/"/g, '%22')}")`, backgroundSize: `${zoom.bw}px ${zoom.bh}px`, backgroundPosition: `${-zoom.bx}px ${-zoom.by}px` }} />
        )}
      </div>
    );
  }

  return (
    <div className="gallery">
      <div ref={box} {...carousel} className={`product-visual detail-art visual-${variant % 4} zoomable carousel`} onPointerMove={onMove} onPointerLeave={() => setZoom(null)}>
        {images.map((src, i) => {
          const active = i === cur;
          return (
            <div key={`${i}-${src}`} className="gallery-slide" data-active={active} aria-hidden={!active ? true : undefined} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}>
              <ProductImage src={src} alt={`${alt} (photo ${i + 1} of ${n})`} fallback={fallback} eager={near(i)} />
            </div>
          );
        })}
        {zoom && !moving && <span className="zoom-lens" aria-hidden="true" style={{ left: zoom.lx, top: zoom.ly, width: zoom.lw, height: zoom.lh }} />}
        <button type="button" className="gallery-arrow prev" aria-label="Previous photo" onClick={() => go(cur - 1)}><span aria-hidden="true">‹</span></button>
        <button type="button" className="gallery-arrow next" aria-label="Next photo" onClick={() => go(cur + 1)}><span aria-hidden="true">›</span></button>
        <p className="gallery-count" aria-live="polite" aria-atomic="true">{cur + 1} / {n}</p>
        <div className="gallery-dots">
          {images.map((src, i) => (
            <button key={`${i}-${src}`} type="button" className="gallery-dot" aria-label={`Show photo ${i + 1} of ${n}`} aria-current={i === cur ? 'true' : undefined} onClick={() => go(i)} />
          ))}
        </div>
      </div>
      {zoom && !moving && current && (
        <div className="zoom-pane" aria-hidden="true" style={{ width: zoom.pw, height: zoom.ph, backgroundImage: `url("${current.replace(/"/g, '%22')}")`, backgroundSize: `${zoom.bw}px ${zoom.bh}px`, backgroundPosition: `${-zoom.bx}px ${-zoom.by}px` }} />
      )}
      {(
        <div ref={strip} className="gallery-thumbs" role="group" aria-label="Product photo thumbnails">
          {images.map((src, i) => (
            <button key={`${i}-${src}`} type="button" className="gallery-thumb" aria-label={`Show photo ${i + 1} of ${n}`} aria-current={i === cur ? 'true' : undefined} onClick={() => go(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
