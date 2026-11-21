/**
 * The small formatting language of the Experience and Certifications fields: bullets, numbers, bold, italic, underline. It is stored as plain
 * text, never as HTML, so nothing a host types can inject markup: the page turns it into React elements itself.
 *
 *   one paragraph per line
 *   "- item" or "• item"          a bullet (consecutive lines make one list)
 *   "1. item"                     a numbered item
 *   **bold**   *italic*   __underline__
 *   \* \_ \\ \- \. \•             a literal character (the editor writes these; older plain text needs none)
 *
 * Text written before the editor existed (plain lines, often with "•" bullets) reads correctly as it is.
 */
export type Span = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Block = { type: 'p'; spans: Span[] } | { type: 'ul' | 'ol'; items: Span[][] };

const ESCAPABLE = '\\*_-•.)';
const BULLET = /^[-•]\s+(.*)$/;
const NUMBER = /^\d+[.)]\s+(.*)$/;

/** Bold, italic and underline switch on and off at their markers; a backslash makes the next marker a plain character. */
export function parseInline(line: string): Span[] {
  const spans: Span[] = [];
  let bold = false, italic = false, underline = false, buf = '';
  const flush = () => {
    if (!buf) return;
    spans.push({ text: buf, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}), ...(underline ? { underline } : {}) });
    buf = '';
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length && ESCAPABLE.includes(line[i + 1])) { buf += line[++i]; continue; }
    if (c === '*' && line[i + 1] === '*') { flush(); bold = !bold; i++; continue; }
    if (c === '*') { flush(); italic = !italic; continue; }
    if (c === '_' && line[i + 1] === '_') { flush(); underline = !underline; i++; continue; }
    buf += c;
  }
  flush();
  return spans;
}

/** The blocks of a stored value, in order. Blank lines are skipped; bullets and numbers stay together as one list. */
export function parseRich(value: string | null | undefined): Block[] {
  const blocks: Block[] = [];
  for (const raw of (value ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = BULLET.exec(line), number = bullet ? null : NUMBER.exec(line);
    const kind = bullet ? 'ul' : number ? 'ol' : null;
    if (kind) {
      const item = parseInline((bullet ?? number)![1]);
      const last = blocks[blocks.length - 1];
      if (last && last.type === kind) last.items.push(item); else blocks.push({ type: kind, items: [item] });
    } else blocks.push({ type: 'p', spans: parseInline(line) });
  }
  return blocks;
}

const plainOf = (spans: Span[]) => spans.map(s => s.text).join('');

/** The text without its formatting, for emails: lists keep their "•" and numbers, one line each. */
export function richToPlain(value: string | null | undefined): string {
  return parseRich(value).flatMap(b => (b.type === 'p' ? [plainOf(b.spans)] : b.items.map((it, i) => `${b.type === 'ul' ? '•' : `${i + 1}.`} ${plainOf(it)}`))).join('\n');
}

/** How many characters a person sees (the formatting marks do not count against the limit). */
export function richLength(value: string | null | undefined): number {
  return parseRich(value).reduce((n, b) => n + (b.type === 'p' ? plainOf(b.spans).length : b.items.reduce((m, it) => m + plainOf(it).length, 0)), 0);
}

/** The most formatting marks a value may carry on top of its visible characters. */
const MARKUP_ALLOWANCE = 1000;

/** True when the value fits: at most `max` visible characters, and a stored size that cannot be padded with marks. */
export function richFits(value: string, max: number): boolean {
  return richLength(value) <= max && value.length <= max + MARKUP_ALLOWANCE;
}

// ---- Writing the stored value from what the editor shows -------------------------------------------------------------------------------

/** A character that would be read as formatting is written escaped. */
export const escapeInline = (text: string): string => text.replace(/[\\*_]/g, m => `\\${m}`);

/** A paragraph that starts like a list item is escaped so it stays a paragraph. */
export const escapeLineStart = (line: string): string =>
  /^[-•]\s/.test(line) ? `\\${line}` : /^\d+[.)]\s/.test(line) ? line.replace(/^(\d+)([.)])/, '$1\\$2') : line;

/** The marks around one piece of text. */
export function wrapSpan(text: string, f: { bold?: boolean; italic?: boolean; underline?: boolean }): string {
  if (!text.trim()) return escapeInline(text);
  let t = escapeInline(text);
  if (f.underline) t = `__${t}__`;
  if (f.italic) t = `*${t}*`;
  if (f.bold) t = `**${t}**`;
  return t;
}

/** The editor's starting HTML for a stored value (text is escaped; only the formatting tags are produced). */
export function richToEditorHtml(value: string | null | undefined): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (spans: Span[]) => spans.map(s => {
    let h = esc(s.text);
    if (s.underline) h = `<u>${h}</u>`;
    if (s.italic) h = `<em>${h}</em>`;
    if (s.bold) h = `<strong>${h}</strong>`;
    return h;
  }).join('');
  return parseRich(value).map(b => (b.type === 'p' ? `<p>${inline(b.spans)}</p>` : `<${b.type}>${b.items.map(it => `<li>${inline(it)}</li>`).join('')}</${b.type}>`)).join('');
}
