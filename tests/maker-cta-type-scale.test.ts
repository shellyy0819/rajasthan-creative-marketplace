import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const norm = (s: string) => s.replace(/\s+/g, ' ');
const site = norm(readFileSync('src/app/globals.css', 'utf8'));
const rule = (selector: string) => new RegExp(`(?:^|[ }])${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(site)?.[1] ?? '';

describe('the home page maker call to action follows the site type scale and tokens', () => {
  it('its heading is the site section heading, its intro the 14px muted lead, its eyebrow the site eyebrow', () => {
    expect(site).toMatch(/\.maker-cta h2 \{ font: 500 clamp\(32px, 4vw, 45px\)\/1\.15 var\(--font-display\)/);
    expect(rule('.maker-cta .mc-lead')).toMatch(/font-size: 14px/);
    expect(rule('.maker-cta .mc-lead')).toMatch(/color: var\(--muted-2\)/);
    expect(site).not.toMatch(/\.maker-cta \.eyebrow/);
  });
  it('the button is the site primary button and the card uses tokens only', () => {
    const page = readFileSync('src/app/page.tsx', 'utf8');
    expect(page).toMatch(/className="button primary" href="\/sell"/);
    const block = site.slice(site.indexOf('.maker-cta {'), site.indexOf('.light {'));
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(rule('.maker-cta')).toMatch(/background: var\(--sand-soft\)/);
  });
});
