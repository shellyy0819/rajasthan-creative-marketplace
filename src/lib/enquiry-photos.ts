import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './image-limits';

export type Photo = { filename: string; content: Buffer; contentType: string };

/** At most this many photos go with one email, and at most this many bytes in all (mail providers cap a message at about 40 MB; most inboxes at 25). */
export const MAX_ATTACHED = 5;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 8_000;

/** Where Craftofy's own uploaded photos live: only these are ever fetched, so a product can never make the server request an arbitrary address. */
export function photoBase(env: Record<string, string | undefined> = process.env): string | null {
  const t = (v: string | undefined) => (v ?? '').trim();
  const base = t(env.S3_PUBLIC_BASE_URL) || (t(env.S3_BUCKET) && t(env.S3_REGION) ? `https://${t(env.S3_BUCKET)}.s3.${t(env.S3_REGION)}.amazonaws.com` : '');
  return base.startsWith('https://') ? base.replace(/\/+$/, '') : null;
}

/**
 * Downloads a product's photos so they can travel with the email. Best effort: a photo that is missing, too big, not a JPEG/PNG/WebP, or too slow
 * is left out and the email still goes. Only Craftofy's own storage is fetched, over https, without following redirects.
 */
export async function fetchProductPhotos(urls: readonly string[], name: string, env: Record<string, string | undefined> = process.env, fetchFn: typeof fetch = fetch): Promise<Photo[]> {
  const base = photoBase(env);
  if (!base) return [];
  const ours = urls.filter(u => u.startsWith(`${base}/`)).slice(0, MAX_ATTACHED);
  const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'product';
  const got = await Promise.all(ours.map(async (u, i): Promise<Photo | null> => {
    try {
      const r = await fetchFn(u, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      const type = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!r.ok || !Object.hasOwn(IMAGE_TYPES, type)) return null;
      if (Number(r.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
      return { filename: `${stem}-${i + 1}.${IMAGE_TYPES[type as keyof typeof IMAGE_TYPES]}`, content: buf, contentType: type };
    } catch { return null; }
  }));
  let total = 0;
  return got.filter((p): p is Photo => !!p).filter(p => (total += p.content.byteLength) <= MAX_TOTAL_BYTES);
}
