import { isHex, onColor } from './contrast';
import { PRESETS, type PresetKey } from './presets';
import type { ThemeConfig } from './types';

const darken = (hex: string, pct = 20) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - pct / 100)).toString(16).padStart(2, '0')).join('').toUpperCase();

const decls = (entries: [string, string][]) =>
  entries.filter(([, v]) => isHex(v)).map(([k, v]) => `${k}:${v}`).join(';');

export function themeCss(preset: PresetKey, config: ThemeConfig): string {
  const p = PRESETS[preset];
  if (!p) return '';
  const override = isHex(config.primary) ? config.primary : undefined;
  if (preset === 'everyday' && !override) return '';
  const sel = `html:root[data-festival="${preset}"]`;

  const brand: [string, string][] = preset === 'everyday' ? [] : Object.entries(p.brand);
  const map = new Map(brand);
  if (override) {
    map.set('--green', override);
    map.set('--on-green', onColor(override));
    map.set('--green-d', darken(override));
  }
  const out = [`${sel}{${decls([...map])}}`];

  const stall = decls(Object.entries(p.stall) as [string, string][]);
  if (stall) {
    out.push(`${sel}[data-theme="light"]{${stall}}`);
    out.push(`@media (prefers-color-scheme: light){${sel}:not([data-theme="dark"]){${stall}}}`);
  }
  return out.join('\n');
}
