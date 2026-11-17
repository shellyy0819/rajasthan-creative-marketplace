import sharp from 'sharp';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './image-limits';
import { photoBase } from './enquiry-photos';
import type { Product } from './types';

/** The size social apps expect for a link preview card. */
export const SHARE_W = 1200;
export const SHARE_H = 630;
/** WhatsApp and others skip previews for large images; stay well under ~300 KB. */
export const SHARE_MAX_BYTES = 250 * 1024;

const ours = (p: Pick<Product, 'images' | 'imageUrl'>, env: Record<string, string | undefined>) => {
  const base = photoBase(env);
  return base ? (p.images ?? (p.imageUrl ? [p.imageUrl] : [])).find(u => u.startsWith(`${base}/`)) : undefined;
};

/** True when the product's first photo is in Craftofy's own storage, so a share image can be made from it. */
export const hasSharePhoto = (p: Pick<Product, 'images' | 'imageUrl'>, env: Record<string, string | undefined> = process.env) => !!ours(p, env);

/**
 * A small copy of the product's first photo for link previews (WhatsApp, Instagram, X ...): the whole picture on a cream card, 1200x630, a JPEG under 250 KB.
 * The stored photo is never changed or replaced; this is made on request and cached by the caller. Null when there is no usable photo.
 */
export async function shareImage(p: Pick<Product, 'images' | 'imageUrl'>, env: Record<string, string | undefined> = process.env, fetchFn: typeof fetch = fetch): Promise<Buffer | null> {
  const url = ours(p, env);
  if (!url) return null;
  try {
    const r = await fetchFn(url, { redirect: 'error', signal: AbortSignal.timeout(8_000) });
    const type = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!r.ok || !Object.hasOwn(IMAGE_TYPES, type) || Number(r.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return null;
    const src = Buffer.from(await r.arrayBuffer());
    if (!src.byteLength || src.byteLength > MAX_IMAGE_BYTES) return null;
    let out: Buffer = Buffer.alloc(0);
    for (const quality of [80, 65, 50, 35]) {
      out = await sharp(src, { limitInputPixels: 50_000_000 }).rotate()
        .resize(SHARE_W, SHARE_H, { fit: 'contain', background: '#f6efe4' }).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (out.byteLength <= SHARE_MAX_BYTES) break;
    }
    return out;
  } catch { return null; }
}
