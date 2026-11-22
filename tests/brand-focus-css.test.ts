import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('the logo link', () => {
  it('shows no focus box, and the rule is more specific than the site-wide link focus ring so it wins', () => {
    expect(css).toMatch(/\.brand:focus-visible \{ outline: none; \}/);
    expect(css).toMatch(/:is\(button, select, input, textarea, a\):focus-visible \{ outline: 2px solid var\(--orange\)/);
  });
});
