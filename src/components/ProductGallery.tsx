'use client';
import { useRef, useState } from 'react';
import { ProductImage } from './ProductImage';

const ZOOM = 2.5;
type Zoom = { lx: number; ly: number; lw: number; lh: number; pw: number; ph: number; bw: number; bh: number; bx: number; by: number };

/** Product page photos: the chosen one large, and a row of thumbnail buttons when there is more than one. */
export function ProductGallery({ images, alt, fallback, variant = 0 }: { images: string[]; alt: string; fallback: React.ReactNode; variant?: number }) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, Math.max(images.length - 1, 0))];
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Amazon-style hover zoom: a lens follows the pointer over the photo and a magnified pane opens beside it.
  // The photo is letterboxed (object-fit: contain), so the lens is kept inside the picture itself, not the frame.
  const onMove = (e: React.MouseEvent) => {
    const el = box.current, img = el?.querySelector<HTMLImageElement>('img.product-photo');
    if (!el || !img || !img.naturalWidth) return setZoom(null);
    const r = el.getBoundingClientRect();
    const fit = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const w = img.naturalWidth * fit, h = img.naturalHeight * fit, ox = (r.width - w) / 2, oy = (r.height - h) / 2;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < ox || x > ox + w || y < oy || y > oy + h) return setZoom(null);
    const lw = Math.min(r.width / ZOOM, w), lh = Math.min(r.height / ZOOM, h);
    const lx = Math.min(Math.max(x - lw / 2, ox), ox + w - lw), ly = Math.min(Math.max(y - lh / 2, oy), oy + h - lh);
    setZoom({ lx, ly, lw, lh, pw: lw * ZOOM, ph: lh * ZOOM, bw: w * ZOOM, bh: h * ZOOM, bx: (lx - ox) * ZOOM, by: (ly - oy) * ZOOM });
  };
  return (
    <div className="gallery">
      <div ref={box} className={`product-visual detail-art visual-${variant % 4}${current ? ' zoomable' : ''}`} onMouseMove={current ? onMove : undefined} onMouseLeave={() => setZoom(null)}>
        <ProductImage key={current ?? 'none'} src={current} alt={alt} fallback={fallback} />
        {zoom && <span className="zoom-lens" aria-hidden="true" style={{ left: zoom.lx, top: zoom.ly, width: zoom.lw, height: zoom.lh }} />}
      </div>
      {zoom && current && (
        <div className="zoom-pane" aria-hidden="true" style={{ width: zoom.pw, height: zoom.ph, backgroundImage: `url("${current.replace(/"/g, '%22')}")`, backgroundSize: `${zoom.bw}px ${zoom.bh}px`, backgroundPosition: `${-zoom.bx}px ${-zoom.by}px` }} />
      )}
      {images.length > 1 && (
        <div className="gallery-thumbs" role="group" aria-label="Product photos">
          {images.map((src, i) => (
            <button key={src} type="button" className="gallery-thumb" aria-label={`Show photo ${i + 1} of ${images.length}`} aria-current={i === index ? 'true' : undefined} onClick={() => setIndex(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
