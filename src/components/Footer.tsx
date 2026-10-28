import Link from 'next/link';
import { connection } from 'next/server';
import { Brand } from './Header';
import { CookieSettings } from './CookieSettings';
import { listActiveCities, type City } from '@/lib/cities';
import { cityLabeller } from '@/lib/city-label';
import { SITE } from '@/lib/site';

const MAKER_MAIL = `mailto:${SITE.email}?subject=Marketplace%20seller%20interest`;

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav className="footer-col" aria-label={title}>
      <h2 className="footer-title">{title}</h2>
      <ul>{children}</ul>
    </nav>
  );
}

/** Link columns (Amazon-style) above a bottom strip; the city column lists every active city and is rendered per request. */
export async function Footer() {
  await connection(); // the city list changes with the catalogue: never freeze it into a prerendered page
  let cities: City[] = [];
  try { cities = await listActiveCities(); } catch (e) { console.error('Footer: could not load the active cities; rendering without city links', e); /* the footer must never take a page down */ }
  const label = cityLabeller(cities);
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <Column title="Get to Know Us">
          <li><Link href="/about">About us</Link></li>
          <li><Link href="/blogs">Blogs</Link></li>
        </Column>
        <Column title="Connect with Us">
          <li><Link href="/contact">Contact us</Link></li>
          <li><a href={`mailto:${SITE.email}`}>Email us</a></li>
        </Column>
        <Column title="Let Us Help You">
          <li><Link href="/help">How it works</Link></li>
          <li><a href={MAKER_MAIL}>For makers</a></li>
          <li><CookieSettings /></li>
        </Column>
        {cities.length > 0 && (
          <Column title="Cities">
            {cities.map(c => <li key={c.slug}><Link href={`/cities/${c.slug}`}>{label(c)}</Link></li>)}
          </Column>
        )}
      </div>
      <div className="footer-base">
        <Brand />
        <p>A demo marketplace concept for India. Payments are not enabled.</p>
        <span>Made with care ✳</span>
      </div>
    </footer>
  );
}
