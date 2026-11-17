import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('navbar seller prompt block (source contract)', () => {
  it('sets its 5px gap on .button.seller-prompt, so the later .button { gap: 20px } cannot override it', () => {
    expect(css).toMatch(/\.button\.seller-prompt \{[^}]*gap: 5px;/);
    expect(css).not.toMatch(/(^|[ }])\.seller-prompt \{[^}]*gap:/);   // a bare .seller-prompt rule would lose to .button
  });
  it('on phones the block is hidden (with the same specificity as its desktop rule, so it really wins) and only the plain Login here button on the right shows', () => {
    expect(css).toMatch(/@media \(max-width: \d+px\) \{[^@]*\.button\.seller-prompt \{ display: none; \} nav \.seller-login-btn \{ display: inline-flex;/);
    expect(css).toMatch(/nav \.seller-login-btn \{ display: none; \}/);                     // and it is hidden on desktop
  });
});
