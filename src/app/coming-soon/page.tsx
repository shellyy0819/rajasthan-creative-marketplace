import Link from 'next/link';
import type { Metadata } from 'next';
import { ComingSoonStall } from '@/components/ComingSoonStall';
import { pageMetadata } from '@/lib/meta';
import { SITE } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Coming soon',
  description: 'Craftofy is setting up shop: handmade finds from independent makers and creative workshops across India, opening soon.',
  path: '/coming-soon',
  noindex: true,
});

const INTEREST_BODY = `Hi Craftofy team,

I'm interested in Craftofy and would love to hear when you open.

Name:
City:
I am a (maker / shopper):
What I make or would like to find on Craftofy:
Instagram / website (optional):

Please keep me posted on your launch. Thank you!
`;
const INTEREST = `mailto:${SITE.email}?subject=${encodeURIComponent('Craftofy launch interest')}&body=${encodeURIComponent(INTEREST_BODY)}`;
const MAKER = `mailto:${SITE.email}?subject=Marketplace%20seller%20interest`;

export default function ComingSoonPage() {
  return (
    <section className="hero coming-soon">
      <div className="hero-copy">
        <span className="eyebrow">OPENING SOON</span>
        <h1><span>Our stall is</span> <span><em>almost ready.</em></span></h1>
        <p>Craftofy is where independent makers and curious shoppers meet. We are setting up shop, one handmade find and one hands-on workshop at a time.</p>
        <div className="hero-actions">
          <a className="button primary" href={INTEREST}>Tell us you&apos;re interested <span>↗</span></a>
          <Link className="button outline" href="/help">See how it works</Link>
        </div>
        <p className="coming-soon-note">Write to <b>{SITE.email}</b> and we will let you know the day we open. Are you a maker? <a href={MAKER}>Say hello</a>.</p>
        <div className="hero-proof"><span>✦ Independent makers</span><span>✦ Local experiences</span><span>✦ Made across India</span></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <ComingSoonStall />
      </div>
    </section>
  );
}
