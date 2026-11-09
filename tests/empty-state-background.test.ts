import { describe, it, expect } from 'vitest';
import { readCss } from './helpers/css';

describe('empty states of the product and workshop lists', () => {
  const css = readCss();
  it('have no card background so they sit on the page or band colour', () => {
    expect(css).toContain('.product-grid .empty,.workshop-list .empty{background:transparent}');
  });
  it('the shared .empty rule keeps its card background for the admin lists', () => {
    expect(css).toMatch(/\.empty\{[^}]*background:var\(--white\)/);
  });
});
