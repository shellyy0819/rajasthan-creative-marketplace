const HEX_RE = /^#[0-9a-f]{6}$/i;

export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX_RE.test(v);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function onColor(bg: string): '#FFFFFF' | '#1B1B1B' {
  return contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#1B1B1B') ? '#FFFFFF' : '#1B1B1B';
}

export const passesContrast = (primary: string): boolean => contrastRatio(primary, onColor(primary)) >= 4.5;

/** The surfaces small text sits on in light mode (paper, white, cream, card): a text colour must keep its contrast on the weakest of them. */
export const LIGHT_SURFACES: readonly string[] = ['#f8f4ee', '#fffdf9', '#eee5d8', '#f9f7f0'];

/**
 * `hex` made as little darker as needed (same hue, scaled toward black) so it reaches `min`:1 on every surface. Used for the small orange text of a
 * festive look, whose accent can be as light as amber. A colour that already passes is returned as given (upper-cased).
 */
export function readableOnLight(hex: string, min = 4.5, surfaces: readonly string[] = LIGHT_SURFACES): string {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let k = 100; k >= 0; k--) {
    const out = '#' + rgb.map((c) => Math.round((c * k) / 100).toString(16).padStart(2, '0')).join('').toUpperCase();
    if (surfaces.every((bg) => contrastRatio(out, bg) >= min)) return out;
  }
  return '#000000';
}
