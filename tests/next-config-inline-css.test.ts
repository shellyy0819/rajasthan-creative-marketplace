import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('first paint does not wait on stylesheet requests (PageSpeed "render-blocking requests")', () => {
  it('next.config puts the site CSS into the page itself', () => {
    const src = fs.readFileSync('next.config.ts', 'utf8');
    expect(src).toMatch(/experimental:\s*\{\s*inlineCss:\s*true\s*\}/);
  });
});
