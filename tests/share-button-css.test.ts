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
  it('on phones Like and Share sit in a row under the product photo; the strip with the same buttons is shown only on larger screens', () => {
    expect(global).toMatch(/\.detail-actions-m \{ display: none; \}/);                                // hidden by default
    const phone = global.match(/@media \(max-width: 700px\) \{ \.detail \{[^}]*\} \.detail-actions-m \{[^}]*\} \.detail-like \{ display: none; \}/);
    expect(phone).not.toBeNull();
    expect(phone![0]).toMatch(/row-gap: 16px/);
    expect(phone![0]).toMatch(/\.detail-actions-m \{[^}]*justify-content: flex-end;/);   // at the right
    expect(phone![0]).toMatch(/\.detail-actions-m \{[^}]*display: flex;/);
    expect(css).toMatch(/\.detail-actions-m \.share-btn \{[^}]*width: 36px;[^}]*height: 36px;[^}]*border-radius: 50%;/);   // small round icons, like the heart
    expect(global).toMatch(/\.detail-actions-m \.like-btn \{[^}]*width: 36px;[^}]*height: 36px;/);
    expect(css).toMatch(/\.detail-actions-m \.share-label \{ display: none; \}/);
  });

  it('on phones the maker card shows a "Contact via" heading and only icons: round 48px buttons in one row, the words visually hidden but kept for screen readers', () => {
    expect(global).toMatch(/\.maker-contact-h \{ display: none; \}/);   // large screens keep the labelled buttons
    const phone = global.match(/@media \(max-width: 700px\) \{ \.detail \{.*?\.maker-card \.maker-icon \{[^}]*\}/)![0];
    expect(phone).toMatch(/\.maker-contact-h \{ display: block;/);
    expect(phone).toMatch(/\.maker-card \.maker-chips \{ display: contents; \}/);                              // every method in one row
    expect(phone).toMatch(/\.maker-card \.maker-main, \.maker-card \.maker-chip \{[^}]*width: 48px;[^}]*height: 48px;[^}]*border-radius: 50%;/);
    expect(phone).toMatch(/\.maker-card \.maker-label \{[^}]*position: absolute;[^}]*width: 1px;[^}]*clip: rect\(0 0 0 0\);/);   // not display: none, which would remove the name for screen readers
  });
});
