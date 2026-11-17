import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('navbar seller prompt block (source contract)', () => {
  it('sets its 5px gap on .button.seller-prompt, so the later .button { gap: 20px } cannot override it', () => {
    expect(css).toMatch(/\.button\.seller-prompt \{[^}]*gap: 5px;/);
    expect(css).not.toMatch(/(^|[ }])\.seller-prompt \{[^}]*gap:/);   // a bare .seller-prompt rule would lose to .button
  });
});
