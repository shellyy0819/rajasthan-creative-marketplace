import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/components/class/ClassDetail.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('the city in the Where line', () => {
  it('looks like a link: underlined, and green on hover', () => {
    expect(css).toMatch(/\.cr-line a \{[^}]*text-decoration: underline;/);
    expect(css).toMatch(/\.cr-line a:hover \{[^}]*color: var\(--green-d\);/);
  });
});
