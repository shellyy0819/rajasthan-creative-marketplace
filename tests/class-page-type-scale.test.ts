import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const norm = (s: string) => s.replace(/\s+/g, ' ');
const site = norm(readFileSync('src/app/globals.css', 'utf8'));
const cls = norm(readFileSync('src/components/class/ClassDetail.css', 'utf8'));
const rule = (css: string, selector: string) => new RegExp(`(?:^|[ }])${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('the class page uses the same type scale as the rest of the site', () => {
  it('the title is the site detail-page title (size, line height and letter spacing)', () => {
    const want = /font: (500 clamp\(30px, 4vw, 44px\)\/1\.1 var\(--font-display\))/.exec(rule(site, '.detail h1'))?.[1];
    expect(want).toBeTruthy();
    expect(norm(rule(cls, '.cd h1'))).toContain(want!.replace('/1.1', ' / 1.1'));
    expect(rule(cls, '.cd h1')).toContain('letter-spacing: -1px');
  });
  it('the intro is the 14px muted line the detail pages use, and the eyebrow is the site eyebrow (9px, 2px spacing)', () => {
    expect(rule(site, '.detail .lead')).toMatch(/font-size: 14px/);
    expect(rule(cls, '.cd-lead')).toMatch(/font-size: 14px/);
    expect(rule(cls, '.cd-lead')).toMatch(/color: var\(--muted-2\)/);
    expect(rule(site, '.eyebrow')).toMatch(/font-size: 9px; letter-spacing: 2px/);
    expect(rule(cls, '.cd-eyebrow')).toMatch(/font-size: 9px; letter-spacing: 2px/);
  });
  it('prices are the 22px the detail pages use, card titles the 18px display face, buttons stay the site 12px .button', () => {
    expect(rule(site, '.detail .price')).toMatch(/font-size: 22px/);
    expect(rule(cls, '.cd-plan-price')).toMatch(/font: 600 22px/);
    expect(rule(site, '.workshop-card h3')).toMatch(/font: 500 18px var\(--font-display\)/);
    expect(rule(cls, '.cd-name')).toMatch(/font: 500 18px var\(--font-display\)/);
    expect(rule(cls, '.cd-btn')).not.toMatch(/font/);
  });
  it('no text on the page is larger than the title or smaller than the site\'s smallest label (9px)', () => {
    const sizes = [...cls.matchAll(/font(?:-size)?: (?:\d+ )?(\d+)px/g)].map(m => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(9);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(26);
  });
});
