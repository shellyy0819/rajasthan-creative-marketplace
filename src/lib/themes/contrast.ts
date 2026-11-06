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
