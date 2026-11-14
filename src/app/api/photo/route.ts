import { createLimiter } from '@/lib/rate-limit';
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

// Load limits. Resizing is CPU and memory work, so it is rationed:
//  - at most MAX_PARALLEL photos are fetched and shrunk at once; others wait in line, and when the line is full the answer is 503
//    (the page then shows the original photo, so nothing breaks);
//  - a visitor waits at most MAX_WAIT_MS for their copy (the original photo loads faster than a long wait), but the job stays in line and
//    finishes, so the next visitor gets the copy from memory;
//  - several requests for the same photo share one job;
//  - each network address gets a share of requests per minute (a page of cards is about 25 requests).
const MAX_PARALLEL = 3, MAX_WAITING = 40, MAX_WAIT_MS = 4000;
let running = 0;
const waiting: Array<() => void> = [];
/** A place to work, or false when the line is full. */
async function turn(): Promise<boolean> {
  if (running < MAX_PARALLEL) { running++; return true; }
  if (waiting.length >= MAX_WAITING) return false;
  await new Promise<void>(go => waiting.push(go));   // the finishing job hands its place straight to us
  return true;
}
function done() { const next = waiting.shift(); if (next) next(); else running--; }
const inFlight = new Map<string, Promise<Buffer | null | 'busy'>>();
export let photoIpLimiter = createLimiter(600, 60_000);
/** The address our own proxy saw: the last X-Forwarded-For entry. The first entries are whatever the client sent, so they must not decide who is limited. */
export function proxyAddress(h: { get(name: string): string | null }): string {
  const last = h.get('x-forwarded-for')?.split(',').pop()?.trim();
  return last || h.get('x-real-ip')?.trim() || 'unknown';
}

async function make(src: string, w: number): Promise<Buffer | null> {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    const len = Number(res.headers.get('content-length') ?? 0);
    if (!res.ok || len > MAX_SOURCE_BYTES) return null;
    const input = Buffer.from(await res.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return null;
    const sharp = (await import('sharp')).default;
    return await sharp(input, { limitInputPixels: 80_000_000 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  } catch (e) {
    console.error('Photo resize failed; the page will show the original.', e instanceof Error ? e.message : e);
    return null;
  }
}

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
  if (!photoIpLimiter.hit(proxyAddress(req.headers))) return new Response(null, { status: 429, headers: { 'retry-after': '60' } });
  const memo = `${w}:${src}`;
  const hit = recall(memo);
  if (hit) return reply(hit);
  let job = inFlight.get(memo);
  if (!job) {
    job = (async () => {
      if (!(await turn())) return 'busy' as const;   // the line is full
      try {
        const made = await make(src, w);
        if (made) remember(memo, made);   // stored here, so a copy finished after its visitor gave up still serves the next one
        return made;
      } finally { done(); }
    })();
    inFlight.set(memo, job);
    void job.finally(() => inFlight.delete(memo));
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const out = await Promise.race([job, new Promise<'busy'>(r => { timer = setTimeout(() => r('busy'), MAX_WAIT_MS); })]).finally(() => clearTimeout(timer));
  if (out === 'busy') return new Response(null, { status: 503, headers: { 'retry-after': '5' } });
  if (!out) return new Response(null, { status: 404 });
  return reply(out);
}
