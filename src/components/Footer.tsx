import Link from 'next/link';
import { connection } from 'next/server';
import { Brand } from './Header';
import { CookieSettings } from './CookieSettings';
import { listActiveCities, type City } from '@/lib/cities';
import { cityLabeller } from '@/lib/city-label';

/** Links to every active city (one with an approved product or workshop); rendered per request. */
export async function Footer() {
  await connection(); // the city list changes with the catalogue: never freeze it into a prerendered page
  let cities: City[] = [];
  try { cities = await listActiveCities(); } catch (e) { console.error('Footer: could not load the active cities; rendering without city links', e); /* the footer must never take a page down */ }
  const label = cityLabeller(cities);
  return (
    <footer>
      <Brand />
      {cities.length > 0 && (
        <nav aria-label="Cities" className="footer-cities">
          {cities.map(c => <Link key={c.slug} href={`/cities/${c.slug}`}>{label(c)}</Link>)}
        </nav>
      )}
      <p>A demo marketplace concept for India. Payments are not enabled.</p>
      <span>Made with care ✳</span>
      <CookieSettings />
    </footer>
  );
}
