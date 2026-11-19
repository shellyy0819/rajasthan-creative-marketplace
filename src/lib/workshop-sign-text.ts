// Pure helpers for the café board text: safe to import from browser components (no database).
/** The words on the café board of the /workshops page. An admin edits them under the Workshops tab of the dashboard. */
export type SignText = { idle: string; one: string; many: string };
export const DEFAULT_SIGN: SignText = { idle: 'Stay Tuned!', one: 'Workshop live', many: '{n} workshops live' };

export const SIGN_MAX = 20; // the board is small: two short lines

/** The text for none, one or several live workshops; {n} becomes the number (99+ above 99). */
export function signFor(t: SignText, live: number): string {
  if (live <= 0) return t.idle;
  if (live === 1) return t.one;
  return t.many.replace(/\{n\}/g, live > 99 ? '99+' : String(live));
}

/** The lines drawn on the board: one line when short, otherwise two, broken at the last space. */
export function boardLines(text: string): string[] {
  if (text.length <= 11) return [text];
  const i = text.lastIndexOf(' ');
  return i > 0 ? [text.slice(0, i), text.slice(i + 1)] : [text];
}

