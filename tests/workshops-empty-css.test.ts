import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/components/WorkshopsEmptyState.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('the hosting card on the empty /workshops page', () => {
  it('is a roomy card: wide, generous padding, larger heading and text', () => {
    expect(css).toMatch(/\.ws-empty \{[^}]*max-width: 660px;/);
    expect(css).toMatch(/\.ws-empty \{[^}]*padding: 40px 44px;/);
    expect(css).toMatch(/\.ws-empty h2 \{[^}]*clamp\(26px, 3\.4vw, 36px\)/);
    expect(css).toMatch(/\.ws-empty p \{[^}]*font-size: 16px;/);
    expect(css).toMatch(/\.ws-empty-steps \{[^}]*font-size: 15px;/);
  });
  it('keeps a smaller padding on phones', () => {
    expect(css).toMatch(/@media \(max-width: 700px\) \{[^@]*\.ws-empty \{ padding: 26px 22px;/);
  });
  it('on phones the card\'s own button is hidden because the header has one', () => {
    expect(css).toMatch(/@media \(max-width: 700px\) \{[^@]*\.ws-empty > \.button \{ display: none; \}/);
  });
  it('the header button shows on phones only', () => {
    expect(css + ' ' + fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ')).toMatch(/\.ws-head-cta \{ display: none; \}/);
    expect(fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ')).toMatch(/@media \(max-width: 700px\) \{[^@]*\.ws-head-cta \{ display: block;/);
  });
  it('on tablets (up to 1000px) the picture sits above a full-width card and both are centred', () => {
    expect(css).toMatch(/@media \(max-width: 1000px\) \{[^@]*\.ws-empty-wrap \{[^}]*justify-content: center;/);
    expect(css).toMatch(/@media \(max-width: 1000px\) \{[^@]*\.ws-empty-art \{[^}]*order: -1;[^}]*margin-inline: auto;/);
    expect(css).toMatch(/@media \(max-width: 1000px\) \{[^@]*\.ws-empty \{[^}]*flex: 1 1 100%;[^}]*max-width: 720px;/);
  });
  it('on phones the picture is small and centred, and the header is tight, so heading, button and picture share the first screen', () => {
    expect(css).toMatch(/@media \(max-width: 700px\) \{[^@]*\.ws-empty-art \{[^}]*max-width: 360px;[^}]*margin: 8px auto 36px;/);
    expect(css).toMatch(/\.ws-empty-art \.cafe-scene \{[^}]*aspect-ratio: 560 \/ 470;[^}]*background: var\(--cs-floor\);/);
    const lst = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(lst).toMatch(/\.page-head\.ws-head \{ padding-top: 20px;/);
    expect(lst).toMatch(/\.page-head\.ws-head h1 \{ font-size: 32px;/);
    expect(lst).toMatch(/\.page-head\.ws-head \.ws-supports \{ display: none; \}/);
  });
});
