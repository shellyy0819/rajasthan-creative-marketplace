import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8');
const block = (query: string) => new RegExp(`@media \\(max-width: ${query}px\\) \\{([^@]*?)\\n\\}`).exec(css.slice(css.indexOf('Phones: the two hero buttons')))?.[1] ?? '';

describe('hero buttons on a phone', () => {
  it('sit in one row (no wrapping), each taking half of it, with equal heights', () => {
    const b = block('600');
    expect(b).toMatch(/\.hero \.hero-actions \{[^}]*flex-wrap: nowrap/);
    expect(b).toMatch(/\.hero \.hero-actions \{[^}]*align-items: stretch/);
    expect(b).toMatch(/\.hero \.hero-actions \.button \{[^}]*flex: 1 1 0/);
    expect(b).toMatch(/\.hero \.hero-actions \.button \{[^}]*min-width: 0/);
  });
  it('on the narrowest phones the arrows go so both labels still fit', () => {
    expect(block('360')).toMatch(/\.hero \.hero-actions \.button > span \{ display: none; \}/);
  });
  it('desktop keeps the wrapping row it had: the base rule is untouched', () => {
    expect(css).toMatch(/\.hero-actions \{\s*flex-wrap: wrap;\s*gap: 14px;\s*\}/);
  });
});
