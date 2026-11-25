import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const norm = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const site = norm(readFileSync('src/app/globals.css', 'utf8'));
const css = norm(readFileSync('src/components/trends/TrendsBlock.css', 'utf8'));
const rule = (sheet: string, selector: string) => new RegExp(`(?:^|[ }])${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(sheet)?.[1] ?? '';

describe('the market trends block uses the same type scale as the rest of the site', () => {
  it('the card title is the site card title (500 18px display face)', () => {
    expect(rule(site, '.workshop-card h3')).toMatch(/font: 500 18px var\(--font-display\)/);
    expect(rule(css, '.trends-card h3')).toMatch(/font: 500 18px(?: \/ [\d.]+)? var\(--font-display\)/);
  });
  it('the section heading is the heading of a section inside a detail page, as the class page uses it', () => {
    const want = 'font: 500 clamp(22px, 2.4vw, 26px)';
    expect(rule(css, '.trends-block .section h2')).toContain(want);
    expect(norm(readFileSync('src/components/class/ClassDetail.css', 'utf8'))).toContain(want);
  });
  it('body text is 12px, notes are 11px, pills are 11px 700', () => {
    expect(rule(css, '.trends-why')).toMatch(/font-size: 12px/);
    expect(rule(css, '.trends-src')).toMatch(/font-size: 11px/);
    expect(rule(css, '.trends-updated')).not.toMatch(/font/);                       // the note is .muted (11px) as on the other pages
    expect(rule(site, '.muted')).toMatch(/font-size: 11px/);
    expect(rule(css, '.trends-pills li')).toMatch(/font-size: 11px; font-weight: 700/);
    expect(rule(site, '.text-link')).toMatch(/font-size: 12px/);
  });
  it('the eyebrow is the site eyebrow (9px, 2px spacing, 700)', () => {
    expect(rule(site, '.eyebrow')).toMatch(/font-size: 9px; letter-spacing: 2px; font-weight: 700/);
    expect(rule(css, '.trends-card .eyebrow')).toMatch(/font-size: 9px; letter-spacing: 2px/);
  });
  it('the grid is auto-fill 280px and one column at 900px and below', () => {
    expect(rule(css, '.trends-grid')).toContain('grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))');
    expect(css).toMatch(/@media \(max-width: 900px\) \{[^@]*\.trends-grid \{ grid-template-columns: 1fr;/);
  });
  it('no text size above 26px or below 9px', () => {
    const sizes = [...css.matchAll(/font(?:-size)?: (?:\d+ )?(?:clamp\()?(\d+)px(?:, [\d.]+vw, (\d+)px)?/g)].flatMap(m => [m[1], m[2]]).filter(Boolean).map(Number);
    expect(sizes.length).toBeGreaterThan(5);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(9);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(26);
  });
  it('colours come from tokens (no hex literals) and fonts from the inherited tokens (no font-family, no literal font name)', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/font-family/);
    expect(css).not.toMatch(/DM Sans|Georgia|Arial|Helvetica|Inter|Roboto|system-ui|monospace|serif/i);
    for (const m of css.matchAll(/font: [^;}]*var\(--font-[^)]*\)/g)) expect(m[0]).toMatch(/var\(--font-(sans|display)\)/);
  });
});
