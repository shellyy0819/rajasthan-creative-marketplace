'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArtistAvatar } from './ArtistAvatar';
import { StallAwning } from './StallAwning';
import type { HomeMaker } from '@/lib/makers';

/** Time between slides while nobody is touching the carousel. */
export const MAKERS_ROTATE_MS = 1000;
/** How long the carousel stays still after a hover leaves, or after a touch, key or wheel input. */
const AFTER_HOVER_MS = 1200;
const AFTER_INPUT_MS = 3000;

/** One maker at a time, in front of a small market stall. Rotates by itself, swipes sideways, and rests while hovered, focused or touched. */
export function MakersCarousel({ makers }: { makers: HomeMaker[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const holdUntil = useRef(0);
  const [index, setIndex] = useState(0);
  const [reduce, setReduce] = useState(false);
  const n = makers.length;

  useEffect(() => { setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);

  const go = useCallback((i: number) => {
    const rail = railRef.current;
    if (rail) rail.scrollTo({ left: i * rail.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }, [reduce]);

  const onScroll = () => {
    const rail = railRef.current;
    if (!rail || !rail.clientWidth) return;
    const i = Math.max(0, Math.min(n - 1, Math.round(rail.scrollLeft / rail.clientWidth)));
    indexRef.current = i;
    setIndex(i);
  };

  useEffect(() => {
    if (reduce || n < 2) return;
    const t = setInterval(() => {
      if (document.hidden || Date.now() < holdUntil.current) return;
      go(indexRef.current + 1 >= n ? 0 : indexRef.current + 1);
    }, MAKERS_ROTATE_MS);
    return () => clearInterval(t);
  }, [reduce, n, go]);

  const holdFor = (ms: number) => { holdUntil.current = Date.now() + ms; };
  const step = (d: number) => { holdFor(AFTER_INPUT_MS); go((indexRef.current + d + n) % n); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    holdFor(AFTER_INPUT_MS);
    if (e.key === 'ArrowRight') { e.preventDefault(); go(Math.min(n - 1, indexRef.current + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(Math.max(0, indexRef.current - 1)); }
  };

  return (
    <section className="section makers-band" id="our-makers" aria-labelledby="makers-h" aria-roledescription="carousel">
      <div className="section-heading">
        <div><span className="eyebrow">OUR SELLERS</span><h2 id="makers-h">Say namaste to the people behind your piece</h2></div>
        {n > 1 && (
          <div className="makers-nav">
            <button type="button" className="button outline" aria-label="Previous maker" onClick={() => step(-1)}>←</button>
            <button type="button" className="button outline" aria-label="Next maker" onClick={() => step(1)}>→</button>
          </div>
        )}
      </div>
      <div
        ref={railRef} className="makers-rail" tabIndex={0} aria-live="off" aria-label="Makers, swipe sideways for more"
        onScroll={onScroll} onKeyDown={onKeyDown}
        onPointerEnter={() => { holdUntil.current = Infinity; }} onPointerLeave={() => holdFor(AFTER_HOVER_MS)}
        onFocus={() => { holdUntil.current = Infinity; }} onBlur={() => holdFor(AFTER_HOVER_MS)}
        onTouchStart={() => holdFor(AFTER_INPUT_MS)} onWheel={() => holdFor(AFTER_INPUT_MS)}
      >
        {makers.map((m, i) => (
          <div key={m.slug} className="maker-slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}>
            <article className="maker-card">
              <div className="maker-stall" aria-hidden="true">
                <StallAwning />
                <div className="maker-scene">
                  <i className="maker-arch maker-arch-1" /><i className="maker-arch maker-arch-2" />
                  <i className="maker-post maker-post-l" /><i className="maker-post maker-post-r" />
                  <div className="maker-frame"><ArtistAvatar src={m.logoUrl} initial={m.name.trim().charAt(0).toUpperCase() || '✿'} /></div>
                  <div className="maker-counter" />
                </div>
              </div>
              <div className="maker-info">
                {m.categories.length > 0 && <ul className="maker-tags" aria-label="Selling in">{m.categories.map(c => <li key={c}>{c}</li>)}</ul>}
                <h3>{m.name}</h3>
                {m.city && <p className="maker-where">{m.city}</p>}
                {m.quote && <p className="maker-quote">“{m.quote}”</p>}
                <div className="maker-actions"><Link className="button primary" href={`/artists/${m.slug}`}>Details <span>↗</span></Link></div>
              </div>
            </article>
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="makers-controls">
          <div className="makers-dots">
            {makers.map((m, i) => <button key={m.slug} type="button" className={i === index ? 'on' : ''} aria-label={`Show ${m.name}`} aria-current={i === index} onClick={() => step(i - indexRef.current)} />)}
          </div>
        </div>
      )}
    </section>
  );
}
