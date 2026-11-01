import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// whitespace-insensitive: the stylesheet may be minified or pretty-printed
const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*([{}:;,])\s*/g, '$1').replace(/\s+/g, ' ');
const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
const sources = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? sources(p) : /\.(tsx?|css)$/.test(e.name) ? [p] : [];
});

describe('one font family across the platform (DM Sans)', () => {
  it('the layout loads DM Sans only, with italics so <em> in headings is a real italic', () => {
    const imports = /import \{([^}]*)\} from 'next\/font\/google'/.exec(layout)![1].split(',').map(s => s.trim()).filter(Boolean);
    expect(imports).toEqual(['DM_Sans']);
    expect(layout).toMatch(/DM_Sans\(\{[^}]*style: \['normal', 'italic'\]/);
  });
  it('defines the display font as a token that resolves to the same family, so one line can add a second family later', () => {
    expect(css).toMatch(/--font-display:var\(--font-sans\),sans-serif/);
  });
  it('no stylesheet rule names another family: every font-family and font shorthand goes through the tokens', () => {
    const decls = [...css.matchAll(/font(?:-family)?:([^;}]*)/g)].map(m => m[1].trim());
    for (const d of decls) {
      if (/^(inherit|\d)/.test(d) === false && !d.includes('var(--font-')) continue; // not a family declaration
      expect(d).not.toMatch(/Playfair|Georgia|Times|Arial|Helvetica|Inter|Roboto|system-ui|monospace|Young Serif/i);
      if (d.includes('var(--font-')) expect(d).toMatch(/var\(--font-(sans|display)\)/);
    }
    expect(css).not.toContain('--font-serif');
    expect(css).not.toMatch(/(^|[^-])serif[;}\s]/);               // generic "serif" fallback (sans-serif is fine)
  });
  it('form controls inherit the page font instead of the browser default', () => {
    expect(css).toMatch(/button,input,select,textarea\{font-family:inherit;?\}/);
  });
  it('no component sets a font family inline', () => {
    for (const f of sources('src')) {
      if (f.endsWith('globals.css')) continue;
      expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/fontFamily|font-family/);
    }
  });
});
