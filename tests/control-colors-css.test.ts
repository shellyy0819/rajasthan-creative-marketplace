import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('form controls keep the site colours on phones (source contract)', () => {
  const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ');
  it('buttons and dropdowns inherit the page text colour instead of the iOS system blue', () => {
    expect(css).toMatch(/button, select \{ color: inherit; \}/);
    expect(css).toMatch(/select \{[^}]*-webkit-text-fill-color: currentColor;/);
  });
  it('the close (✕) button takes the text colour too', () => {
    expect(css).toMatch(/\.icon-btn \{[^}]*color: inherit;/);
  });
});
