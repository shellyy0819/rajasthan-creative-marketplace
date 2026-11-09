import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('layout has no "Skip to content" link', () => {
  it('the root layout renders no skip link', () => {
    const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
    expect(layout).not.toMatch(/skip-link|Skip to content/i);
    expect(layout).toContain('<main id="main">'); // the landmark itself stays
  });
  it('the stylesheet has no leftover skip-link rules', () => {
    expect(fs.readFileSync('src/app/globals.css', 'utf8')).not.toContain('.skip-link');
  });
});
