// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { PRESETS } from '@/lib/themes/presets';
import { STICKERS } from '@/lib/themes/stickers';
import { placementTransform } from '@/lib/themes/transform';
import { fitText } from '@/components/theme/fit';
import { ThemeHead } from '@/components/theme/ThemeHead';
import { ThemeBanner } from '@/components/theme/ThemeBanner';
import { STICKER_ART } from '@/components/theme/art';
import { HeroStall } from '@/components/HeroStall';

const mocks = vi.hoisted(() => ({ cookie: undefined as string | undefined, session: null as unknown, getActiveTheme: vi.fn(), getTheme: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'rr_theme_preview' && mocks.cookie !== undefined ? { name: n, value: mocks.cookie } : undefined) }) }));
vi.mock('@/auth', () => ({ auth: async () => mocks.session }));
vi.mock('@/lib/themes/store', () => ({ getActiveTheme: mocks.getActiveTheme, getTheme: mocks.getTheme }));
import { getRenderTheme } from '@/lib/themes/render';

const E = PRESETS.everyday.config;
const stall = (o: Partial<React.ComponentProps<typeof HeroStall>> = {}) => renderToStaticMarkup(<HeroStall {...o} />);

describe('placementTransform', () => {
  it('scales about the centre of the sticker box (Santa at 1.5x)', () => {
    expect(placementTransform(STICKERS.xsanta.box, { id: 'xsanta', x: 0, y: 0, s: 1.5 }))
      .toBe('translate(0 0) translate(446 59) scale(1.5) translate(-446 -59)');
  });
});

describe('fitText', () => {
  it('leaves short text alone', () => { expect(fitText('Sale', 8, 54)).toEqual({ text: 'Sale' }); });
  it('adds textLength for the Diwali signboard', () => {
    const sign = PRESETS.diwali.config.sign;
    expect(sign.length).toBeGreaterThan(26);
    const r = fitText(sign, 13, 176);
    expect(r.text).toBe(sign);
    expect(r.textLength).toBe(176);
  });
  it('truncates a 200-char unbroken word with an ellipsis', () => {
    const r = fitText('W'.repeat(200), 13, 176);
    expect(r.text.endsWith('…')).toBe(true);
    expect(r.text.length).toBeLessThan(60);
    expect(r.textLength).toBe(176);
  });
});

describe('HeroStall props', () => {
  it('defaults render today\'s wording and the bunting', () => {
    const h = stall();
    expect(h).toContain('Maker&#x27;s Row · Stall 12');
    for (const t of ['LIVE TODAY', 'Block printing', '4 pm · free to try']) expect(h).toContain(t);
    expect(h).toContain('M27 23h18l-9 20z');
    expect(h).not.toContain('textLength="54"');
    expect(h).not.toContain('textLength="176"');
  });
  it('omits the bunting when off', () => {
    expect(stall({ bunting: false })).not.toContain('M27 23h18l-9 20z');
  });
  it('escapes hostile wording', () => {
    const h = stall({ sign: '<script>alert(1)</script> & "q"', chalkTitle: '<b>x</b>' });
    expect(h).not.toContain('<script');
    expect(h).not.toContain('<b>');
    expect(h).toContain('&lt;script&gt;');
  });
  it('renders only stickers that have art', () => {
    STICKER_ART.kalash = () => <circle data-testid="kalash-art" r="3" />;
    try {
      const h = stall({ stickers: [{ id: 'nope', x: 0, y: 0, s: 1 }, { id: 'xtree', x: 0, y: 0, s: 1 }, { id: 'kalash', x: 5, y: 6, s: 2 }] });
      expect(h.match(/kalash-art/g)).toHaveLength(1);
      expect(h).toContain('transform="translate(5 6) translate(30 633) scale(2) translate(-30 -633)"');
      expect(h.lastIndexOf('kalash-art')).toBeGreaterThan(h.indexOf('A little more handmade'));
    } finally { delete STICKER_ART.kalash; }
  });
});

describe('ThemeHead and ThemeBanner', () => {
  it('ThemeHead emits the css and neutralises </style>', () => {
    const h = renderToStaticMarkup(<ThemeHead preset="diwali" css={'a{b:c}</style><script>x</script>'} />);
    expect(h).toContain('id="festive-theme"');
    expect(h).toContain('a{b:c}');
    expect(h.match(/<\/style>/g)).toHaveLength(1);
    expect(h).not.toContain('<script');
  });
  it('ThemeBanner renders the text in a note', () => {
    const h = renderToStaticMarkup(<ThemeBanner text="Happy Diwali" />);
    expect(h).toContain('class="festive-banner"');
    expect(h).toContain('role="note"');
    expect(h).toContain('Happy Diwali');
  });
});

describe('getRenderTheme', () => {
  const diwali = { preset: 'diwali' as const, config: PRESETS.diwali.config };
  beforeEach(() => {
    mocks.cookie = undefined; mocks.session = null;
    mocks.getActiveTheme.mockReset().mockResolvedValue({ preset: 'everyday', config: E });
    mocks.getTheme.mockReset().mockResolvedValue({ id: 7, ...diwali });
  });
  afterEach(() => vi.restoreAllMocks());

  it('uses the active theme and no preview by default', async () => {
    mocks.getActiveTheme.mockResolvedValue(diwali);
    const t = await getRenderTheme();
    expect(t).toMatchObject({ preset: 'diwali', previewing: false });
    expect(t.css).toContain('data-festival="diwali"');
  });
  it('ignores the preview cookie when the visitor is not an admin', async () => {
    mocks.cookie = '7';
    for (const s of [null, { user: { email: 'a@b.c', role: 'customer' } }]) {
      mocks.session = s;
      expect(await getRenderTheme()).toMatchObject({ preset: 'everyday', previewing: false });
    }
    expect(mocks.getTheme).not.toHaveBeenCalled();
  });
  it('honours the preview cookie for an admin', async () => {
    mocks.cookie = '7'; mocks.session = { user: { email: 'a@b.c', role: 'admin' } };
    expect(await getRenderTheme()).toMatchObject({ preset: 'diwali', previewing: true });
    expect(mocks.getTheme).toHaveBeenCalledWith(7);
  });
  it('ignores a junk or unknown preview id', async () => {
    mocks.session = { user: { email: 'a@b.c', role: 'admin' } };
    mocks.cookie = 'abc';
    expect(await getRenderTheme()).toMatchObject({ preset: 'everyday', previewing: false });
    mocks.cookie = '99'; mocks.getTheme.mockResolvedValue(undefined);
    expect(await getRenderTheme()).toMatchObject({ preset: 'everyday', previewing: false });
  });
  it('falls back to Everyday when the store throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getActiveTheme.mockRejectedValue(new Error('db down'));
    expect(await getRenderTheme()).toMatchObject({ preset: 'everyday', config: E, css: '', previewing: false });
  });
  it('falls back to Everyday on a malformed stored config or unknown preset', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getActiveTheme.mockResolvedValue({ preset: 'diwali', config: { banner: 3 } });
    expect(await getRenderTheme()).toMatchObject({ preset: 'everyday', config: E });
    mocks.getActiveTheme.mockResolvedValue({ preset: 'holi', config: E });
    expect(await getRenderTheme()).toMatchObject({ preset: 'everyday', config: E });
    expect(err).toHaveBeenCalledTimes(2);
  });
});

describe('theme css wiring', () => {
  const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ');
  it('defines the banner, the on-green default and the taller topbar', () => {
    expect(css).toMatch(/--banner-h: 38px/);
    expect(css).toMatch(/--on-green: #fff/);
    expect(css).toMatch(/\.festive-banner \{[^}]*height: var\(--banner-h\)[^}]*var\(--on-green\)/);
  });
});
