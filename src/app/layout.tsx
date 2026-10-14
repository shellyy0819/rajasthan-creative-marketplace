import type { Metadata, Viewport } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { SITE, siteUrl } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/jsonld';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StoreProvider } from '@/components/StoreProvider';

const sans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });
const serif = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { siteName: SITE.name, locale: SITE.locale, type: 'website' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export const viewport: Viewport = { themeColor: '#f8f4ee', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <StoreProvider>
        <Header />
        <main id="main">{children}</main>
        </StoreProvider>
        <Footer />
      </body>
    </html>
  );
}
