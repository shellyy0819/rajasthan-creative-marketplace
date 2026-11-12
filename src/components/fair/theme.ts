/** Colours the canvas needs, read from the site's design tokens so the fair follows light and dark mode. */
export type Colors = {
  ink: string; muted: string; paper: string; cream: string; white: string; line: string; green: string; greenInk: string; orange: string; sage: string;
  indigo: string; mustard: string; wood: string; woodD: string; terraD: string; chalk: string; board: string; ground: string; skin: string; skin2: string; hair: string;
};
export function readColors(el: Element = document.documentElement): Colors {
  const cs = getComputedStyle(el), g = (n: string) => cs.getPropertyValue('--' + n).trim();
  return {
    ink: g('ink'), muted: g('muted'), paper: g('paper'), cream: g('cream'), white: g('white'), line: g('line'), green: g('green'), greenInk: g('white'), orange: g('orange'), sage: g('sage'),
    indigo: g('stall-indigo'), mustard: g('stall-mustard'), wood: g('stall-wood'), woodD: g('stall-wood-d'), terraD: g('stall-terra-d'), chalk: g('stall-chalk'), board: g('stall-board'),
    ground: g('stall-ground'), skin: g('stall-skin'), skin2: g('stall-skin-2'), hair: g('stall-hair'),
  };
}
/**
 * The page's font for canvas text. The canvas cannot use CSS variables, so this takes the family out of the computed `font` shorthand of the page body
 * (the site loads one family and everything inherits it). Falls back to the generic sans-serif.
 */
export function canvasFamily(): string {
  const f = getComputedStyle(document.body).font;
  const m = /\d(?:px|pt|em|rem|%)(?:\s*\/\s*[^\s]+)?\s+(.+)$/.exec(f);
  return m ? m[1] : 'sans-serif';
}
