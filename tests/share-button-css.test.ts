import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/components/ShareButton.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const global = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('Share dialog styles', () => {
  it('the preview photo stays inside its small box: ProductImage draws the photo absolutely (inset 0), so the box must be positioned and clip it', () => {
    expect(global).toMatch(/\.product-photo \{[^}]*position: absolute;[^}]*inset: 0;/);   // the reason the box needs `position: relative`
    expect(css).toMatch(/\.share-thumb \{[^}]*position: relative;/);
    expect(css).toMatch(/\.share-thumb \{[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.share-thumb \{[^}]*width: 56px;[^}]*height: 56px;/);
  });
});
