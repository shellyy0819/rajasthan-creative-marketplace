import Link from 'next/link';
import { Brand } from './Header';
import { CookieSettings } from './CookieSettings';
import { CITIES, citySlug } from '@/lib/catalog';

export function Footer() {
  return (
    <footer>
      <Brand />
      <nav aria-label="Cities" style={{ display: 'flex', gap: 14, fontSize: 11 }}>
        {CITIES.map(c => <Link key={c} href={`/cities/${citySlug(c)}`}>{c}</Link>)}
      </nav>
      <p>A demo marketplace concept for India. Payments are not enabled.</p>
      <span>Made with care ✳</span>
      <CookieSettings />
    </footer>
  );
}
