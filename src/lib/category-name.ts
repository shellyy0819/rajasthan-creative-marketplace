// Pure category-name rule shared by the server (categories.ts) and client components. No db imports.
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} &\-',.()/]*$/u;
export const CATEGORY_HINT = 'name must be 2-40 characters: letters, numbers, spaces and & - \' , . ( ) /';
export const collapseSpaces = (s: string) => s.trim().replace(/\s+/g, ' ');

/** The collapsed name when it follows the rule (2-40 characters, allowed characters, a letter, no control characters). */
export function checkCategoryName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || /\p{Cc}/u.test(raw)) return { ok: false, error: CATEGORY_HINT }; // tabs/newlines/control characters
  const name = collapseSpaces(raw);
  if (name.length < 2 || name.length > 40 || !NAME_RE.test(name) || !/\p{L}/u.test(name)) return { ok: false, error: CATEGORY_HINT };
  return { ok: true, name };
}
