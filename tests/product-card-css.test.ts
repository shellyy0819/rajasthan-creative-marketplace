import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const global = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
// the last phone block that styles the product card's details
const phone = [...global.matchAll(/@media \(max-width: 600px\) \{ \.product-card \{ border-radius: 18px; \}.*?\.pc-top \{/g)].map(m => m[0]).pop()!;

describe('product cards on phones', () => {
  it('the price and phone row sits on the same line in every card of a row: the details fill the card and the row is pushed to the bottom', () => {
    expect(phone).toMatch(/\.product-card \.product-info \{[^}]*flex: 1 1 auto;/);
    expect(phone).toMatch(/\.product-card \.product-bottom \{[^}]*margin-top: auto;/);
  });
  it('the title and maker lines keep a fixed height (min and max, two lines each) so a short or long name never moves the row', () => {
    expect(phone).toMatch(/\.product-card \.product-info h3 \{[^}]*min-height: 2\.4em;[^}]*max-height: 2\.4em;/);
    expect(phone).toMatch(/\.product-card \.product-info p\.pc-who \{[^}]*min-height: 2\.6em;[^}]*max-height: 2\.6em;[^}]*overflow: hidden;/);
  });
  it('the phone button is a 30px circle with a 14px handset, the same size as the heart', () => {
    const block = global.match(/@media \(max-width: 600px\) \{ \/\* ?Phones: photo on top.*?\.product-card \.contact-handset \{[^}]*\}/) ?? global.match(/\.product-card \.contact-btn\.contact-icon-btn \{ width: 30px;[^}]*\} \.product-card \.contact-handset \{[^}]*\}/);
    expect(block![0]).toMatch(/\.product-card \.contact-btn\.contact-icon-btn \{[^}]*width: 30px;[^}]*height: 30px;/);
    expect(block![0]).toMatch(/\.product-card \.contact-handset \{[^}]*width: 14px;[^}]*height: 14px;/);
    expect(global).toMatch(/\.product-card \.like-btn \{[^}]*width: 30px;[^}]*height: 30px;[^}]*padding: 0;/);
  });
});
