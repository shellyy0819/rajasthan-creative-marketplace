/** Profile links built from whatever the artist typed: a handle, an @handle or a full url. */
export function instagramUrl(value: string) {
  const handle = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '');
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

export function youtubeUrl(value: string) {
  if (/^https:\/\/(www\.)?youtube\.com\//i.test(value) || /^https:\/\/youtu\.be\//i.test(value)) return value;
  return `https://www.youtube.com/@${encodeURIComponent(value.replace(/^@/, ''))}`;
}
