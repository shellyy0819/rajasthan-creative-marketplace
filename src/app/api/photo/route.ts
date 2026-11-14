import { keyFromUrl, storageConfig } from '@/lib/storage';
import { PHOTO_WIDTHS } from '@/lib/photo-sizes';
export const dynamic = 'force-dynamic';

const MAX_SOURCE_BYTES = 6 * 1024 * 1024;   // uploads are capped at 5 MB
// One day, not a year: when a seller removes a photo, copies already handed out stop being served within a day.
const CACHE = 'public, max-age=86400, stale-while-revalidate=3600';

/**
 * A smaller copy of one of our own product photos. Phones were downloading the original 1 to 5 MB uploads to fill a 380 px card.
 * Only urls inside this bucket's products/ area are served (this is not an open image proxy); anything else, or any failure, is a plain 404
 * and the page falls back to the original photo.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const w = Number(q.get('w'));
  const src = q.get('u') ?? '';
  const cfg = storageConfig();
  if (!cfg || !(PHOTO_WIDTHS as readonly number[]).includes(w) || !keyFromUrl(cfg, src)) return new Response(null, { status: 404 });
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const len = Number(res.headers.get('content-length') ?? 0);
    if (!res.ok || len > MAX_SOURCE_BYTES) return new Response(null, { status: 404 });
    const input = Buffer.from(await res.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return new Response(null, { status: 404 });
    const sharp = (await import('sharp')).default;
    const out = await sharp(input, { limitInputPixels: 80_000_000 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    return new Response(new Uint8Array(out), { headers: { 'content-type': 'image/webp', 'cache-control': CACHE, 'x-content-type-options': 'nosniff' } });
  } catch (e) {
    console.error('Photo resize failed; the page will show the original.', e instanceof Error ? e.message : e);
    return new Response(null, { status: 404 });
  }
}
