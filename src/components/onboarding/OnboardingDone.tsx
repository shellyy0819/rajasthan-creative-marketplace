'use client';
import { useEffect, useRef } from 'react';

const STEPS: { title: string; text: string }[] = [
  { title: 'Add your first product.', text: 'Photos, a price and a short description.' },
  { title: 'Craftofy publishes it.', text: 'New products stay hidden until we publish them.' },
  { title: 'Customers find you.', text: 'They contact you directly using the details you gave.' },
];

/** Board 5: shown after the profile is saved. Real anchors, so absolute dashboard-origin URLs work in split-host mode. */
export function OnboardingDone({ name, brand, postsUrl, postsUrlNew }: { name: string; brand: string; postsUrl: string; postsUrlNew: string }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus(); }, []); // the Finish button that had focus is gone
  return (
    <div className="onboard-done">
      <span className="onboard-done-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <h1 ref={h1} tabIndex={-1}>You are in, {name}.</h1>
      <p className="onboard-lead">Your seller profile for <strong className="onboard-brand">{brand}</strong> is ready. Here is what happens next.</p>
      <ol className="onboard-next">
        {STEPS.map((s, i) => (
          <li key={s.title}><span className="onboard-next-n" aria-hidden="true">{i + 1}</span><span><b>{s.title}</b> {s.text}</span></li>
        ))}
      </ol>
      <div className="onboard-done-actions">
        <a className="button primary onboard-cta" href={postsUrlNew}>Add your first product</a>
        <a className="onboard-done-link" href={postsUrl}>Go to my dashboard</a>
      </div>
    </div>
  );
}
