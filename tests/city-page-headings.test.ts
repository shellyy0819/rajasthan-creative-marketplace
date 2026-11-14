import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('city page headings (source contract)', () => {
  const src = fs.readFileSync('src/app/cities/[city]/page.tsx', 'utf8');
  it('names the city in the breadcrumb, eyebrow and h1 only: neutral wording, no subtitle, plain section headings', () => {
    expect(src).toContain('<h1>Products &amp; workshops in {city}</h1>');
    expect(src).not.toContain('Independent makers');
    expect(src).toContain('<h2 id="c-shop">Products</h2>');
    expect(src).toContain('<h2 id="c-ws">Workshops</h2>');
    expect(src.match(/<h2[^>]*>[^<]*\{city\}/g)).toBeNull();
  });
  it('does not call every product handmade, and empty sections no longer point at a filter this page lacks', () => {
    expect(src).not.toMatch(/[Hh]andmade/);
    expect(src).not.toMatch(/different city or filter|another city or search/);
  });
});
