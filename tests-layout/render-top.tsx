import { renderToStaticMarkup } from 'react-dom/server';
import { SessionProvider } from 'next-auth/react';
import { ThemeBanner } from '@/components/theme/ThemeBanner';
import { ThemeHead } from '@/components/theme/ThemeHead';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { PRESETS, type PresetKey } from '@/lib/themes/presets';
import { themeCss } from '@/lib/themes/css';

export const presetKeys = () => Object.keys(PRESETS) as PresetKey[];

/**
 * The public top of the site (banner, header, hero) for one preset, as a full static HTML
 * document. Mirrors src/app/layout.tsx: same <html data-festival>, same ThemeHead, same order.
 * `css` is the real compiled stylesheet (src/app/globals.css), inlined so no server is needed.
 */
export function renderTop(preset: PresetKey, css: string): string {
  const config = PRESETS[preset].config;
  const body = renderToStaticMarkup(
    <SessionProvider session={null}>
      <ThemeBanner text={config.banner} />
      <Header />
      <main id="main">
        <Hero stall={{ sign: config.sign, chalkLabel: config.chalkLabel, chalkTitle: config.chalkTitle, chalkSub: config.chalkSub, bunting: config.bunting, stickers: config.stickers }} />
      </main>
    </SessionProvider>,
  );
  const head = renderToStaticMarkup(<ThemeHead preset={preset} css={themeCss(preset, config)} />);
  // --font-sans is normally set by next/font; every theme gets the same fallback so fonts cannot differ.
  return `<!doctype html><html lang="en-IN" data-festival="${preset}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--font-sans:Arial,Helvetica,sans-serif}</style><style>${css}</style>${head}</head><body>${body}</body></html>`;
}
