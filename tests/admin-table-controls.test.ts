import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync('src/components/AdminTableControls.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const rowCss = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ');

describe('dashboard table controls follow the admin design system', () => {
  it('buttons and dropdowns share the control height, the control border, the 3px radius and the 600 11px font', () => {
    expect(css).toMatch(/\.admin-table \.button,[^{]*\{[^}]*min-height: var\(--control-h\);[^}]*border: 1px solid var\(--control-border\);[^}]*border-radius: 3px;[^}]*font: 600 11px var\(--font-sans\);/);
    expect(rowCss).toMatch(/--control-h: 36px/);
  });
  it('Delete is a danger outline and Primary is the green fill, as in the other admin rows', () => {
    expect(css).toMatch(/\.admin-table \.button\.danger-outline \{ color: var\(--danger\); border-color: var\(--danger-line\); \}/);
    expect(css).toMatch(/\.admin-table \.button\.primary \{ background: var\(--green\)/);
  });
});
