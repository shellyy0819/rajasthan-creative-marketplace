import { isHex, readableOnLight } from './contrast';
import { PRESETS, type PresetKey } from './presets';

/** The primary green and the text on it. Every look keeps them (the site's own light and dark values): no festival and no admin setting changes the green. */
export const GREEN_TOKENS: readonly string[] = ['--green', '--green-d', '--on-green'];

const decls = (entries: [string, string][]) =>
  entries.filter(([, v]) => isHex(v)).map(([k, v]) => `${k}:${v}`).join(';');

export function themeCss(preset: PresetKey): string {
  const p = PRESETS[preset];
  if (!p || preset === 'everyday') return '';
  const sel = `html:root[data-festival="${preset}"]`;

  // The green is left out so it keeps its own light and dark values on every page; only the accent colours change.
  const brand = Object.entries(p.brand).filter(([k]) => !GREEN_TOKENS.includes(k));
  const out = [`${sel}{${decls(brand)}}`];

  // Small orange text (eyebrows, labels) follows the look's accent, darkened just enough to stay readable on the light surfaces. In dark mode it is the accent itself (the site's own rule).
  const accent = p.brand['--orange'];
  const text = isHex(accent) ? `--orange-text:${readableOnLight(accent)}` : '';
  if (text) {
    out.push(`${sel}[data-theme="light"]{${text}}`);
    out.push(`@media (prefers-color-scheme: light){${sel}:not([data-theme="dark"]){${text}}}`);
  }

  const stall = decls(Object.entries(p.stall) as [string, string][]);
  if (stall) {
    out.push(`${sel}[data-theme="light"]{${stall}}`);
    out.push(`@media (prefers-color-scheme: light){${sel}:not([data-theme="dark"]){${stall}}}`);
  }
  return out.join('\n');
}
