/** Profile links built from whatever the artist typed: a handle, an @handle or a full url. */
const IG_URL = /^(https?:\/\/)?(www\.)?instagram\.com\//i;

/** The handle part of whatever the artist typed: "@name", "name", "instagram.com/name/?igsh=…" or a full url. */
function instagramName(value: string) {
  const v = value.trim();
  const name = IG_URL.test(v) ? v.replace(IG_URL, '').split(/[/?#]/)[0] : v.replace(/\/$/, '');
  return name.replace(/^@/, '');
}

export function instagramUrl(value: string) {
  return `https://www.instagram.com/${encodeURIComponent(instagramName(value))}/`;
}

/** "@name" for display, whichever form was stored. */
export const instagramHandle = (value: string) => `@${instagramName(value)}`;

export function youtubeUrl(value: string) {
  if (/^https:\/\/(www\.)?youtube\.com\//i.test(value) || /^https:\/\/youtu\.be\//i.test(value)) return value;
  return `https://www.youtube.com/@${encodeURIComponent(value.replace(/^@/, ''))}`;
}
