/** Client-safe: the widths the photo route serves, and the address of a resized copy. */
export const PHOTO_WIDTHS = [480, 960, 1600] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

/** Only photos in our own S3 bucket have a resizer behind them; any other host is shown as given. */
export function canResize(src: string): boolean {
  try { const u = new URL(src); return u.protocol === 'https:' && u.hostname.endsWith('.amazonaws.com'); } catch { return false; }
}
export const resizedUrl = (src: string, w: PhotoWidth) => `/api/photo?w=${w}&u=${encodeURIComponent(src)}`;
export const resizedSrcSet = (src: string) => PHOTO_WIDTHS.map(w => `${resizedUrl(src, w)} ${w}w`).join(', ');
