'use client';
import { useState } from 'react';
import { ProductImage } from './ProductImage';

/** Product page photos: the chosen one large, and a row of thumbnail buttons when there is more than one. */
export function ProductGallery({ images, alt, fallback, variant = 0 }: { images: string[]; alt: string; fallback: React.ReactNode; variant?: number }) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, Math.max(images.length - 1, 0))];
  return (
    <div className="gallery">
      <div className={`product-visual detail-art visual-${variant % 4}`}>
        <ProductImage key={current ?? 'none'} src={current} alt={alt} fallback={fallback} />
      </div>
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
