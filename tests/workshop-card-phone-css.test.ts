import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workshop cards on tablets and phones (source contract)', () => {
  const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
  const block = css.match(/@media \(max-width: 900px\) \{ article\.workshop-card, article\.workshop-card\.with-photo \{[^@]*?\} \}/)?.[0] ?? '';
  it('a card with a photo and one without share one frame: the same picture column, aligned to the top', () => {
    expect(block).toMatch(/article\.workshop-card, article\.workshop-card\.with-photo \{ grid-template-columns: 88px minmax\(0, 1fr\); align-items: start; \}/);
  });
  it('the picture and the date tile are the same 88px square', () => {
    expect(block).toMatch(/article\.workshop-card \.date-tile \{[^}]*width: 88px; height: 88px;/);
  });
  it('the price row sits in the text column, under the text, on every card', () => {
    expect(block).toMatch(/article\.workshop-card \.workshop-price \{[^}]*grid-column: 2;[^}]*justify-content: space-between;/);
  });
  it('the old photo-only 88px rule is gone, so no card has a different column', () => {
    expect(css).not.toContain('@media (max-width: 900px) { .workshop-card.with-photo');
  });
});
