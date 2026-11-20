import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const global = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('Similar products / More from the maker heading on phones', () => {
  it('the small label and the "See all" link sit on the same line: baseline alignment in the phone block, so neither sits higher', () => {
    const phone = global.match(/@media \(max-width: 600px\) \{.*?\.section-heading\.related-head \{[^}]*\}/)![0];
    expect(phone).toMatch(/\.section-heading \{ align-items: start;/);                         // the general rule this one refines for the product page
    expect(phone).toMatch(/\.section-heading\.related-head \{ align-items: baseline; \}/);
  });
});
