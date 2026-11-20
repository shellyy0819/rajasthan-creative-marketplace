import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/app/globals.css', 'utf8');
const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.:]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('modal backdrop', () => {
  it('is one shared, strongly dimmed colour (at least 90% opaque, near black so it also dims the dark theme)', () => {
    const m = css.match(/--backdrop:\s*#([0-9a-f]{6})([0-9a-f]{2});/i);
    expect(m, '--backdrop token').not.toBeNull();
    expect(parseInt(m![2], 16) / 255).toBeGreaterThanOrEqual(0.9);
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m![1].slice(i, i + 2), 16));
    expect(Math.max(r, g, b)).toBeLessThan(0x20);
  });
  it('dialog::backdrop and .admin-modal both use it, with a blur', () => {
    for (const sel of ['dialog::backdrop', '.admin-modal']) {
      const r = rule(sel);
      expect(r, sel).toContain('background: var(--backdrop)');
      expect(r, sel).toContain('backdrop-filter: blur(4px)');
    }
  });
});
