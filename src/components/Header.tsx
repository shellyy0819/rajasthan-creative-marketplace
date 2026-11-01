import Link from 'next/link';
import { CartButton } from './CartButton';
import { AuthButton } from './AuthButton';
import { ThemeToggle } from './ThemeToggle';

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Craftology home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo logo-light" src="/logos/horizontal-color.png" alt="Craftology" width={1600} height={415} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo logo-dark" src="/logos/horizontal-dark.png" alt="" width={1600} height={415} />
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
        <AuthButton />
        {/* <CartButton /> */}
        <ThemeToggle />
      </nav>
    </header>
  );
}
