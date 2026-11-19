export const JOIN_LINK_HINT = 'Use a full https link, for example https://zoom.us/j/123.';

/** A meeting link must be a plain https link to a real host (a dot in the name), without a username or password, up to 500 characters. */
export function validJoinLink(v: string): boolean {
  const t = v.trim();
  if (!t || t.length > 500) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.');
  } catch { return false; }
}
