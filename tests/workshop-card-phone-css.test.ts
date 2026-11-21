import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workshop cards on tablets and phones (source contract)', () => {
  const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
  const block = css.match(/@media \(max-width: 900px\) \{ article\.workshop-card, article\.workshop-card\.with-photo \{.*?\} \} /)?.[0] ?? '';
  it('a card with a photo and one without share one frame: the same picture column, aligned to the top', () => {
    expect(block).toMatch(/article\.workshop-card, article\.workshop-card\.with-photo \{ grid-template-columns: 96px minmax\(0, 1fr\);[^}]*align-items: start;/);
  });
  it('the picture and the date tile are the same 96px square', () => {
    expect(block).toMatch(/article\.workshop-card \.date-tile \{[^}]*width: 96px; height: 96px;/);
  });
  it('the level and language tags and the footer bar run the full width of the card', () => {
    expect(block).toMatch(/article\.workshop-card \.ws-badges \{ grid-column: 1 \/ -1;/);
    expect(block).toMatch(/article\.workshop-card \.workshop-price \{[^}]*grid-column: 1 \/ -1;[^}]*justify-content: space-between;[^}]*border-top: 1px solid var\(--line\);[^}]*background: var\(--paper\);/);
  });
  it('the Reserve spot button is a green button at the standard control height (36px) in the footer', () => {
    expect(block).toMatch(/article\.workshop-card \.workshop-price button \{[^}]*height: var\(--control-h\); padding: 0 14px;[^}]*background: var\(--green\); color: var\(--on-green\);/);
  });
  it('each fact shows once: the photo chip, photo trial tag and inline seats hide on phones; the label above the title, the tag by the price and the seats under it hide on laptops', () => {
    expect(css).toMatch(/\.ws-eyebrow, \.ws-price-trial, \.ws-seats \{ display: none; \}/);
    expect(block).toMatch(/article\.workshop-card \.tile-chip, article\.workshop-card \.tile-trial, article\.workshop-card \.ws-seats-inline \{ display: none; \}/);
  });
  it('the old photo-only 88px rule is gone, so no card has a different column', () => {
    expect(css).not.toContain('@media (max-width: 900px) { .workshop-card.with-photo');
    expect(css).not.toContain('88px');
  });
});
