import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const norm = (s: string) => s.replace(/\s+/g, ' ');
const css = norm(readFileSync('src/app/globals.css', 'utf8'));
const engine = readFileSync('src/components/fair/engine.ts', 'utf8');
const rule = (selector: string) => new RegExp(`(?:^|[ }])${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

// On a phone the toolbar sits in the stage above the canvas. In full screen the stage must have a definite
// height and the canvas must fill only what is left below the toolbar. Otherwise the canvas reads the stage
// height, which includes itself, and grows on every resize until the fair is off screen.
describe('the fair in full screen on a phone', () => {
  it('the full-screen container is a block, so the percentage heights below it have a definite parent', () => {
    expect(rule('.fair.is-full')).toMatch(/display: block/);
  });

  it('the full-screen button sits at the top on a phone, beside the Menu button, and the toolbar leaves room for it', () => {
    const phone = css.slice(css.indexOf('.fair-stage { display: flex; flex-direction: column; }'));
    const block = phone.slice(0, phone.indexOf('.fair.is-full {'));
    expect(block).toMatch(/\.fair-fs \{[^}]*top: 8px[^}]*bottom: auto/);
    // The toolbar is a flex item with z-index 2 and comes later in the page; in Safari's engine it paints over the button unless the button is above it.
    expect(block).toMatch(/\.fair-fs \{[^}]*z-index: 3/);
    expect(block).toMatch(/\.fair-toolbar \{[^}]*padding-right: 52px/);
  });

  it('the canvas height leaves out whatever sits above it in the stage (the toolbar)', () => {
    const fill = /if \(fill && box\.clientHeight > 200\) \{([^}]*)\}/.exec(engine)?.[1] ?? '';
    expect(fill).toMatch(/box\.clientHeight - canvas\.offsetTop/);
  });
});
