import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/categories/categories.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const global = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('category page styles line up with the page heading', () => {
  it('the category list and pagination use the same side padding as .page-head and .crumbs (8.5%)', () => {
    expect(global).toMatch(/\.page-head \{ padding: 56px 8\.5% 12px;/);
    expect(global).toMatch(/\.crumbs \{[^}]*padding: 22px 8\.5% 0;/);
    expect(css).toMatch(/\.cat-list \{[^}]*padding: 0 8\.5% 64px;/);
    expect(css).toMatch(/\.cat-pages \{[^}]*padding: 8px 8\.5% 64px;/);
  });
  it('the home block list adds no side padding of its own (its section already has it)', () => {
    expect(css).toMatch(/\.cat-list-home \{ padding: 0 0 24px;/);
  });
});
