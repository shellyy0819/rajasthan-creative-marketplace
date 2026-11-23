import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8');

describe('section padding', () => {
  it('on a phone every .section has 32px above and below (and the 5% side gutter)', () => {
    const phone = /@media \(max-width: 600px\) \{\n  \.topbar \{[\s\S]*?\n\}\n/.exec(css)![0];
    expect(phone).toMatch(/\n  \.section \{\n    padding: 32px 5%;\n  \}/);
  });
  it('on larger screens it keeps its roomy padding', () => {
    expect(css).toMatch(/\n\.section \{\n  padding: 90px 8\.5% 100px;\n\}/);
  });
});
