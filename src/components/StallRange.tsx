'use client';
import { useEffect, useRef } from 'react';

/**
 * Tells the people of the home stall (StallCrowd) how far they may walk: from the left edge of the hero section to its right edge. It measures
 * where the picture sits in the section and sets --L and --R on the crowd (how many picture units lie to the left and to the right of it).
 * Without it the crowd uses generous defaults from the stylesheet, so the picture still works before this runs.
 */
export function StallRange() {
  const mark = useRef<SVGGElement>(null);
  useEffect(() => {
    const crowd = mark.current?.parentElement;
    const svg = mark.current?.ownerSVGElement;
    if (!crowd || !svg) return;
    const area = svg.closest('.hero') ?? svg.parentElement;
    if (!area) return;
    const measure = () => {
      const m = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;
      if (!m || !m.a) return; // no layout (or no SVG matrix): keep the defaults
      const box = area.getBoundingClientRect();
      const left = (m.e - box.left) / m.a;               // picture units between the section's left edge and the picture's left edge
      const right = (box.right - (m.e + 600 * m.a)) / m.a; // and between the picture's right edge and the section's right edge
      crowd.style.setProperty('--L', String(Math.max(0, Math.round(left))));
      crowd.style.setProperty('--R', String(Math.max(0, Math.round(right))));
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(area); ro?.observe(svg);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return <g ref={mark} />;
}
