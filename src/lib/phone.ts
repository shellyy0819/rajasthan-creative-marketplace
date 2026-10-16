/** Indian mobile number: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9. Spaces and hyphens are allowed between digits. */
export const PHONE_RE = /^(?:\+?91|0)?[6-9]\d{9}$/;
/** Same rule as PHONE_RE, written for the HTML `pattern` attribute (accepts separators). */
export const PHONE_PATTERN = '(\\+?91[ \\-]?|0)?[6-9]([ \\-]?[0-9]){9}';
export const PHONE_HINT = 'Enter a valid Indian mobile number, e.g. 9989898999 or +91 99898 98999.';

/** Returns the compact form (separators removed) or undefined when invalid. */
export function normalizePhone(input: string): string | undefined {
  const compact = input.trim().replace(/[\s-]/g, '');
  return PHONE_RE.test(compact) ? compact : undefined;
}
