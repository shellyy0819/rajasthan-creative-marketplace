const CHAR_W = 0.56;
const HARD_CAP = 1.6;

/**
 * Keeps wording inside its SVG slot. Width is estimated as chars * fontSize * 0.56; text that would overflow gets a
 * `textLength` (callers set lengthAdjust="spacingAndGlyphs"), and text beyond 1.6x the slot is cut with an ellipsis
 * first so one very long word cannot distort the glyphs.
 */
export function fitText(text: string, fontSize: number, maxWidth: number): { text: string; textLength?: number } {
  const perChar = fontSize * CHAR_W;
  if (text.length * perChar <= maxWidth) return { text };
  const cap = Math.floor((maxWidth * HARD_CAP) / perChar);
  const out = text.length > cap ? text.slice(0, Math.max(1, cap - 1)) + '…' : text;
  return { text: out, textLength: maxWidth };
}
