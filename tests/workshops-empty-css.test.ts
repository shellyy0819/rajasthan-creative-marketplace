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
});
