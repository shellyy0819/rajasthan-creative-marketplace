import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ');
/** The phone block of globals.css that holds the section heading rules. */
const phone = css.slice(css.indexOf('@media (max-width: 600px) {'));

describe('home section headings on a phone: the link shares the small label\'s line', () => {
  it('a heading with a link aligns the label and the link on one baseline, like the product page\'s related headings', () => {
    expect(phone).toContain('.section-heading:has(> .text-link) { align-items: baseline; }');
    expect(phone).toContain('.section-heading.related-head { align-items: baseline; }');
  });
  it('the link never wraps or shrinks (it was breaking into three lines beside the label)', () => {
    expect(phone).toContain('.section-heading > .text-link { flex: none; white-space: nowrap; }');
  });
  it('is not the old top alignment that put the link 7px above the label', () => {
    expect(phone).not.toContain('.section-heading:has(> .text-link) { align-items: start');
  });
  it('desktop keeps its own rule: the row is bottom aligned and spread', () => {
    expect(css).toContain('.section-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 36px; }');
  });
});
