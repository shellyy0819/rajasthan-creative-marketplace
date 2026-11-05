import Link from 'next/link';
import type { Metadata } from 'next';
import { ComingSoonStall } from '@/components/ComingSoonStall';
import { pageMetadata } from '@/lib/meta';
import { contactEmail } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Coming soon',
  description: 'Craftofy is setting up shop: handmade finds from independent makers and creative workshops across India, opening soon.',
  path: '/coming-soon',
  noindex: true,
});

export default function ComingSoonPage() {
  const email = contactEmail(); // no address configured: no email links or text
  const INTEREST = email ? `mailto:${email}?subject=Craftofy%20launch%20interest` : undefined;
  const MAKER = email ? `mailto:${email}?subject=Marketplace%20seller%20interest` : undefined;
  return (
    <section className="hero coming-soon">
      <div className="hero-copy">
        <span className="eyebrow">OPENING SOON</span>
        <h1><span>Our stall is</span> <span><em>almost ready.</em></span></h1>
        <p>Craftofy is where independent makers and curious shoppers meet. We are setting up shop, one handmade find and one hands-on workshop at a time.</p>
        <div className="hero-actions">
          {INTEREST && <a className="button primary" href={INTEREST}>Tell us you&apos;re interested <span>↗</span></a>}
          <Link className="button outline" href="/help">See how it works</Link>
        </div>
        {email && <p className="coming-soon-note">Write to <b>{email}</b> and we will let you know the day we open. Are you a maker? <a href={MAKER}>Say hello</a>.</p>}
        <div className="hero-proof"><span>✦ Independent makers</span><span>✦ Local experiences</span><span>✦ Made across India</span></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <ComingSoonStall />
      </div>
    </section>
  );
}
