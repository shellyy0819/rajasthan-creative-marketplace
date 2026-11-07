import Link from 'next/link';
import { CartButton } from './CartButton';
import { AuthButton } from './AuthButton';
import { ThemeToggle } from './ThemeToggle';
import { hostConfig } from '@/lib/hosts';

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Craftofy home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo logo-light" src="/logos/horizontal-color.png" alt="Craftofy" width={1600} height={482} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo logo-dark" src="/logos/horizontal-dark.png" alt="" width={1600} height={482} />
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
        <AuthButton dashboardUrl={hostConfig().dashboardOrigin ?? ''} />
        {/* <CartButton /> */}
        <ThemeToggle />
      </nav>
    </header>
  );
}
