import Link from 'next/link';
import { CartButton } from './CartButton';

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Rang Rajasthan home">
      <span className="brand-mark" aria-hidden="true">✿</span>
      <span><b>rang rajasthan</b><small>MADE BY HAND, SHARED WITH HEART</small></span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="topbar">
      <Brand />
      <nav aria-label="Primary">
        <Link href="/shop">Shop handmade</Link>
        <Link href="/workshops">Workshops &amp; pop-ups</Link>
        <CartButton />
      </nav>
    </header>
  );
}
