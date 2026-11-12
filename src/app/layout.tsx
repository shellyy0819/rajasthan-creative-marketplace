import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { SITE, siteUrl } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/jsonld';
import { isFairOpen } from '@/lib/fair-settings';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StoreProvider } from '@/components/StoreProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { Analytics } from '@/components/Analytics';
import { hostConfig } from '@/lib/hosts';
import { SplashScreen } from '@/components/SplashScreen';
import { themeInitScript, splashInitScript } from '@/lib/init-scripts';
import { ThemeBanner } from '@/components/theme/ThemeBanner';
import { ThemeHead } from '@/components/theme/ThemeHead';
import { ThemePreviewBar } from '@/components/theme/ThemePreviewBar';
import { getRenderTheme } from '@/lib/themes/render';

const sans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { siteName: SITE.name, locale: SITE.locale, type: 'website' },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: [{ url: '/icons/favicon.svg', type: 'image/svg+xml' }, { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true, title: SITE.name, statusBarStyle: 'default',
    startupImage: [
      { url: '/splash/screen-color-1284x2778.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: light)' },
      { url: '/splash/screen-dark-1284x2778.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (prefers-color-scheme: dark)' },
    ],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export const viewport: Viewport = { themeColor: '#c8553d', colorScheme: 'light dark', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, fairOpen] = await Promise.all([getRenderTheme(), isFairOpen()]);
  return (
    <html lang="en-IN" className={sans.variable} data-festival={theme.preset} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `${themeInitScript};${splashInitScript}` }} /><ThemeHead preset={theme.preset} css={theme.css} /></head>
      <body>
        <SplashScreen />
        <a className="skip-link" href="#main">Skip to content</a>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <AuthProvider>
        <StoreProvider>
        <ThemeBanner text={theme.config.banner} />
        <Header fair={fairOpen} />
        <main id="main">{children}</main>
        </StoreProvider>
        </AuthProvider>
        <Footer />
        {theme.previewing && <ThemePreviewBar />}
        <Suspense fallback={null}><Analytics measurementId={process.env.GA_MEASUREMENT_ID} dashboardHost={hostConfig().dashboardHost} /></Suspense>
      </body>
    </html>
  );
}
