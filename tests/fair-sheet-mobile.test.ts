import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ');
// the phone rules for the stall sheet: everything from the `.fair-item` base rule to the next full-screen rule
const base = css.indexOf('.fair-item-actions { display: grid; gap: 6px; }');
const phone = /@media \(max-width: 700px\) \{ \.fair-sheet-body[^@]*?\} \}/.exec(css.slice(base))?.[0] ?? '';

describe('the stall sheet on a phone', () => {
  it('shows each product as a compact row: a small picture beside the name, price and button', () => {
    expect(phone).toMatch(/\.fair-items \{[^}]*grid-template-columns: 1fr/);
    expect(phone).toMatch(/\.fair-item \{[^}]*grid-template-columns: 76px minmax\(0, 1fr\)/);
    expect(phone).toMatch(/\.fair-item-pic \{[^}]*grid-row: 1 \/ span 3/);
  });

  it('keeps the name, price and buttons in the second column', () => {
    expect(phone).toMatch(/\.fair-item h3, \.fair-item \.fair-price, \.fair-item-actions \{ grid-column: 2; \}/);
  });
});
