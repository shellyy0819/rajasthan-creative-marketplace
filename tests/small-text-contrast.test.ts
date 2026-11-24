import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { LIGHT_SURFACES, contrastRatio, readableOnLight } from '@/lib/themes/contrast';
import { PRESETS, type PresetKey } from '@/lib/themes/presets';
import { themeCss } from '@/lib/themes/css';

const css = fs.readFileSync('src/app/globals.css', 'utf8');
/** The first value a token gets in the file: the light :root block. */
const light = (name: string) => new RegExp(`^\\s*${name}: (#[0-9a-f]{6});`, 'im').exec(css)?.[1] as string;

describe('small text keeps 4.5:1 on every light surface (PageSpeed "sufficient contrast")', () => {
  it.each(['--orange-text', '--muted', '--muted-2'])('%s', (token) => {
    const fg = light(token);
    expect(fg).toBeTruthy();
    for (const bg of LIGHT_SURFACES) expect(contrastRatio(fg, bg), `${token} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps the order of the greys: ink-soft is the darkest, then muted-2, then muted', () => {
    const lum = (h: string) => contrastRatio(h, '#ffffff');
    expect(lum(light('--ink-soft'))).toBeGreaterThan(lum(light('--muted-2')));
    expect(lum(light('--muted-2'))).toBeGreaterThan(lum(light('--muted')));
  });
  it('in dark mode small orange text is the accent itself (both dark blocks)', () => {
    expect(css.match(/--orange-text: var\(--orange\);/g)).toHaveLength(2);
  });
  it('eyebrows and the other small orange labels use the readable token; only large headings and icons keep --orange', () => {
    const flat = css.replace(/\s+/g, ' ');
    expect(flat).toMatch(/\.eyebrow \{ font-size: 9px; letter-spacing: 2px; font-weight: 700; color: var\(--orange-text\); \}/);
    expect(flat).toMatch(/\.product-meta \{[^}]*color: var\(--orange-text\)/);
    expect(flat).toMatch(/\.hero h1 em, h2 em \{ color: var\(--orange\);/);
    expect(fs.readFileSync('src/components/class/ClassDetail.css', 'utf8')).toMatch(/\.cd-eyebrow \{[^}]*color: var\(--orange-text\)/);
  });
  it('the home hero\'s supporting line uses a muted that passes', () => {
    expect(css.replace(/\s+/g, ' ')).toMatch(/\.hero-proof \{[^}]*color: var\(--muted\)/);
  });
});

describe('festive looks', () => {
  const festive = (Object.keys(PRESETS) as PresetKey[]).filter(k => k !== 'everyday');
  it('every look gives its small orange text a passing colour on the light surfaces, in light mode only', () => {
    for (const k of festive) {
      const out = themeCss(k);
      const m = /--orange-text:(#[0-9A-F]{6})/.exec(out);
      expect(m, k).toBeTruthy();
      for (const bg of LIGHT_SURFACES) expect(contrastRatio(m![1], bg), `${k} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      // never in the unconditional block: dark mode keeps the accent as it is
      const first = out.split('\n')[0];
      expect(first).not.toContain('--orange-text');
    }
  });
  it('readableOnLight leaves a colour that already passes alone and darkens a light one just enough', () => {
    expect(readableOnLight('#9A4A28')).toBe('#9A4A28');
    const amber = readableOnLight('#E08A1E');
    expect(amber).not.toBe('#E08A1E');
    for (const bg of LIGHT_SURFACES) expect(contrastRatio(amber, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(amber, '#f8f4ee')).toBeLessThan(5.2); // not darkened more than needed
  });
  it('Everyday has no theme css (its own tokens apply)', () => { expect(themeCss('everyday')).toBe(''); });
});
