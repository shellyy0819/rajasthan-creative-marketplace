import Link from 'next/link';
import { connection } from 'next/server';
import { Brand } from './Header';
import { CookieSettings } from './CookieSettings';
import { listActiveCities, type City } from '@/lib/cities';
import { contactEmail, INSTAGRAM_HANDLE } from '@/lib/site';
import { instagramUrl, instagramHandle } from '@/lib/social';
import { cityLabeller } from '@/lib/city-label';

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
  const year = new Date().getFullYear();
  const years = year > 2026 ? `2026–${year}` : '2026'; // first published 2026
  const makerMail = `mailto:${contactEmail()}?subject=Marketplace%20seller%20interest`;
  return (
    <footer className="site-footer">
      <div className="footer-top"><Brand /></div>
      <div className="footer-grid">
        <Column title="Get to Know Us">
          <li><Link href="/about">About us</Link></li>
          {/* <li><Link href="/blogs">Blogs</Link></li> */}
        </Column>
        <Column title="Connect with Us">
          <li><Link href="/contact">Contact us</Link></li>
          <li>
            <a className="footer-ig" href={instagramUrl(INSTAGRAM_HANDLE)} target="_blank" rel="noopener noreferrer" aria-label={`Craftofy on Instagram, ${instagramHandle(INSTAGRAM_HANDLE)}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <defs>
                  <linearGradient id="footer-ig-gradient" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#feda75" />
                    <stop offset="0.25" stopColor="#fa7e1e" />
                    <stop offset="0.5" stopColor="#d62976" />
                    <stop offset="0.75" stopColor="#962fbf" />
                    <stop offset="1" stopColor="#4f5bd5" />
                  </linearGradient>
                </defs>
                <g stroke="url(#footer-ig-gradient)">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                </g>
                <circle cx="17.5" cy="6.5" r="1" fill="#d62976" />
              </svg>
              {instagramHandle(INSTAGRAM_HANDLE)}
            </a>
          </li>
        </Column>
        <Column title="Let Us Help You">
          <li><Link href="/help">How it works</Link></li>
          {/* <li><a href={makerMail}>For makers</a></li> */}
          <li><Link href="/sell" prefetch={false}>Seller login</Link></li>
          {/* <li><CookieSettings /></li> */}
        </Column>
        {/* {cities.length > 0 && (
          <Column title="Cities">
            {cities.map(c => <li key={c.slug}><Link href={`/cities/${c.slug}`}>{label(c)}</Link></li>)}
          </Column>
        )} */}
      </div>
      <div className="footer-base">
        <p className="copyright">© {years} Craftofy. All rights reserved.</p>
      </div>
    </footer>
  );
}
