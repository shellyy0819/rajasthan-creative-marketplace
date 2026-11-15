import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8');
const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** The value a custom property has in each theme: [light, dark]. The dark one is the last definition in the file. */
const values = (name: string) => { const all = [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map(m => m[1]); return [all[0], all[all.length - 1]]; };

describe('text drawn on the stall\'s paper tags stays readable in both themes', () => {
  it('uses the fixed dark text colour, not the page ink that turns light in dark mode', () => {
    const hero = fs.readFileSync('src/components/HeroStall.tsx', 'utf8');
    expect(hero).toMatch(/st-t-hair" fontSize="11">₹450/);
    expect(hero).toMatch(/className="st-t-hair">UPI</);
    const soon = fs.readFileSync('src/components/ComingSoonStall.tsx', 'utf8');
    expect(soon).toMatch(/className="st-t-hair">FRAGILE</);
    expect(soon).toMatch(/className="st-t-hair">price</);
  });
  it('the paper and the text colour keep at least 7:1 contrast in light and dark', () => {
    const chalk = values('--stall-chalk'), hair = values('--stall-hair');
    for (const i of [0, 1]) expect(contrast(chalk[i], hair[i])).toBeGreaterThanOrEqual(7);
  });
});
