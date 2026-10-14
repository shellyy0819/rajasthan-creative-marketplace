import Link from 'next/link';

export function Hero() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">THE CREATIVE SIDE OF RAJASTHAN</span>
          <h1>Good things are<br /><em>made by hand.</em></h1>
          <p>Discover independent makers, thoughtful handmade finds, and creative workshops happening around Rajasthan.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/shop">Explore handmade <span>↗</span></Link>
            <Link className="text-link" href="/workshops">Find a workshop ↓</Link>
          </div>
          <div className="hero-proof"><span>✦ Independent makers</span><span>✦ Local experiences</span><span>✦ Rajasthan first</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun"></div>
          <div className="arch arch-back"></div>
          <div className="arch arch-front"><div className="pottery">❀</div></div>
          <div className="art-label">A little more handmade<br />goes a long way.</div>
          <div className="art-sticker">LOCAL<br />LOVE ✳</div>
        </div>
      </section>
      <section className="intro">
        <span className="eyebrow">A MARKETPLACE WITH A LOCAL SOUL</span>
        <h2>Shop a story. <em>Join a moment.</em></h2>
        <p>From one-of-a-kind crafts to workshops at your favourite cafés — find your next favourite thing, or learn to make it yourself.</p>
      </section>
    </>
  );
}
