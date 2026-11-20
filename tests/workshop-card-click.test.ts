import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workshop card click area (source contract)', () => {
  const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8');
  it('the title link stretches over the whole card, and contact/reserve controls stay above it', () => {
    expect(css).toMatch(/\.workshop-card h3 a::after\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0/);
    expect(css).toMatch(/\.workshop-card\s*\{\s*position:\s*relative/);
    expect(css).toMatch(/\.workshop-price a,[^{]*\.workshop-price button\s*\{[^}]*z-index:\s*1/);
  });
});

describe('contact buttons line up with the price on a workshop card (source contract)', () => {
  const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
  it('they sit flush right under the price, without the button\'s own side padding pushing the text in', () => {
    expect(css).toMatch(/\.workshop-card \.ws-contact \{[^}]*justify-content: flex-end;/);
    expect(css).toMatch(/\.workshop-card \.ws-contact \.button \{[^}]*padding-right: 0;/);
  });
});
