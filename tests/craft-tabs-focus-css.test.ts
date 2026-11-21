import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

describe('the category chips on the home page', () => {
  it('leave room for the 4px focus ring (2px line, 2px gap) inside the scrolling row, so the selected chip is not clipped', () => {
    const block = /\.craft-tabs \{([^}]*)\}/.exec(css)![1];
    expect(block).toMatch(/overflow-x: auto;/);
    const [top, right, , left] = (/padding: (\d+)px (\d+)px (\d+)px;/.exec(block)!.slice(1).map(Number) as number[]).concat([0]);
    expect(top).toBeGreaterThanOrEqual(4);
    expect(right).toBeGreaterThanOrEqual(4);
    expect(left).toBe(0); // three-value shorthand: the left side equals the right
    expect(block).toMatch(/margin: -4px -4px 0;/); // pulled out by the same amount, so the chips do not move
  });
});
