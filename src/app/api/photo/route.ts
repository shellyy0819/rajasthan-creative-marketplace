import { keyFromUrl, storageConfig } from '@/lib/storage';
import { PHOTO_WIDTHS } from '@/lib/photo-sizes';
export const dynamic = 'force-dynamic';

const MAX_SOURCE_BYTES = 6 * 1024 * 1024;   // uploads are capped at 5 MB
// One day, not a year: when a seller removes a photo, copies already handed out stop being served within a day.
const CACHE = 'public, max-age=86400, stale-while-revalidate=3600';

// Recent resized copies, kept in memory so every visitor does not make the server fetch and shrink the same photo again.
// Bounded by bytes (16 MB in all, no copy over 512 KB) and by age: an entry expires 5 minutes after it was made and reading it does not extend that,
// so a photo a seller removes is not served from here for long.
const MAX_TOTAL_BYTES = 16 * 1024 * 1024, MAX_ENTRY_BYTES = 512 * 1024, TTL_MS = 5 * 60_000;
const recent = new Map<string, { at: number; body: Buffer }>();
let total = 0;
const forget = (k: string) => { const e = recent.get(k); if (e) { total -= e.body.length; recent.delete(k); } };
const remember = (k: string, body: Buffer) => {
  if (body.length > MAX_ENTRY_BYTES) return;
  forget(k);
  recent.set(k, { at: Date.now(), body }); total += body.length;
  for (const old of recent.keys()) { if (total <= MAX_TOTAL_BYTES) break; forget(old); }   // oldest first
};
const recall = (k: string): Buffer | undefined => {
  const e = recent.get(k);
  if (!e) return undefined;
  if (Date.now() - e.at > TTL_MS) { forget(k); return undefined; }
  return e.body;
};
const reply = (body: Buffer) => new Response(new Uint8Array(body), { headers: { 'content-type': 'image/webp', 'cache-control': CACHE, 'x-content-type-options': 'nosniff' } });

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
  const memo = `${w}:${src}`;
  const hit = recall(memo);
  if (hit) return reply(hit);
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const len = Number(res.headers.get('content-length') ?? 0);
    if (!res.ok || len > MAX_SOURCE_BYTES) return new Response(null, { status: 404 });
    const input = Buffer.from(await res.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return new Response(null, { status: 404 });
    const sharp = (await import('sharp')).default;
    const out = await sharp(input, { limitInputPixels: 80_000_000 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    remember(memo, out);
    return reply(out);
  } catch (e) {
    console.error('Photo resize failed; the page will show the original.', e instanceof Error ? e.message : e);
    return new Response(null, { status: 404 });
  }
}
