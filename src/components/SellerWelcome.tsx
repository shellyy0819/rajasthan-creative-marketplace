'use client';
import { signIn } from 'next-auth/react';

const POINTS = [
  ['No GST or PAN to start.', 'Just your name, number and a few details about your craft.'],
  ['Customers contact you directly.', 'You agree the details and are paid by them.'],
  ['Start listing at once.', 'Your products go live after Craftofy publishes them.'],
];

export function SellerWelcome() {
  return (
    <section className="onboard-wrap">
      <div className="onboard-card">
        <span className="eyebrow">For makers</span>
        <h1>List your craft on Craftofy</h1>
        <p className="onboard-lead">Customers find you, see your work and contact you directly. Setting up takes about three minutes.</p>
        <ul className="onboard-points">
          {POINTS.map(([b, t]) => (
            <li key={b}><b>{b}</b> {t}</li>
          ))}
        </ul>
        <button type="button" className="button primary onboard-cta" onClick={() => signIn('google', { callbackUrl: '/sell' })}>Continue with Google</button>
        <p className="onboard-fine">We use Google only to confirm your name and email. We never post anything.</p>
      </div>
    </section>
  );
}
