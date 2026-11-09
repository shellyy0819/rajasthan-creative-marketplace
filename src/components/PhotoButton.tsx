'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Full-screen photo viewer: Esc or a click outside closes it, arrow keys (or the buttons) move between photos. */
function PhotoViewer({ images, start, label, onClose }: { images: string[]; start: number; label: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = images.length > 1;
  const go = (d: number) => setI(n => (n + d + images.length) % images.length);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    // Capture phase + stopImmediatePropagation: Esc closes only the viewer, not the dialog underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
      else if (many && e.key === 'ArrowLeft') { e.stopImmediatePropagation(); go(-1); }
      else if (many && e.key === 'ArrowRight') { e.stopImmediatePropagation(); go(1); }
      else if (e.key === 'Tab') { e.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, many, images.length]);
  return createPortal(
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={`${label}, photo ${i + 1} of ${images.length}`}
      onMouseDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }} onClick={e => e.stopPropagation()}>
      <button ref={closeRef} type="button" className="photo-viewer-close" aria-label="Close photo" onClick={onClose}>✕</button>
      {many && <button type="button" className="photo-viewer-nav prev" aria-label="Previous photo" onClick={() => go(-1)}>‹</button>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[i]} alt={`${label}, photo ${i + 1} of ${images.length}`} referrerPolicy="no-referrer" onMouseDown={e => e.stopPropagation()} />
      {many && <button type="button" className="photo-viewer-nav next" aria-label="Next photo" onClick={() => go(1)}>›</button>}
      {many && <span className="photo-viewer-count" aria-hidden="true">{i + 1} / {images.length}</span>}
    </div>,
    document.body,
  );
}

/** Wraps a thumbnail so a click opens the full-size photo(s). Without any photo it renders the children as they are. */
export function PhotoButton({ images, label, children }: { images: (string | undefined)[]; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const list = images.filter((x): x is string => !!x);
  if (!list.length) return <>{children}</>;
  return (
    <>
      <button type="button" className="photo-open" aria-label={`View photo of ${label}`} onClick={() => setOpen(true)}>{children}</button>
      {open && <PhotoViewer images={list} start={0} label={label} onClose={() => setOpen(false)} />}
    </>
  );
}
