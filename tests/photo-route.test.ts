import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { GET, photoIpLimiter } from '@/app/api/photo/route';
import { canResize, resizedSrcSet, resizedUrl } from '@/lib/photo-sizes';

const BASE = 'https://bkt.s3.ap-south-1.amazonaws.com';
let n = 0;
// A new photo address per test, because copies are remembered in memory between calls.
let PHOTO = '';
const call = (qs: string) => GET(new Request(`http://x/api/photo?${qs}`));
const env = { S3_BUCKET: 'bkt', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' };
let original: Buffer;

beforeEach(async () => {
  PHOTO = `${BASE}/products/user-1/photo-${++n}.jpg`;
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  original = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#c66b43' } }).jpeg().toBuffer();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(original), { headers: { 'content-length': String(original.length) } })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('GET /api/photo', () => {
  it('serves a smaller webp copy of a photo in our bucket, cached for a day', async () => {
    const res = await call(`w=960&u=${encodeURIComponent(PHOTO)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('max-age=86400');
    expect(res.headers.get('cache-control')).not.toContain('immutable');
    const out = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(960);
    expect(out.length).toBeLessThan(original.length);
  });
  it('does not fetch or resize the same photo twice in a row', async () => {
    const qs = `w=480&u=${encodeURIComponent(`${BASE}/products/user-1/twice.jpg`)}`;
    expect((await call(qs)).status).toBe(200);
    expect((await call(qs)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('forgets a copy after five minutes, and reading it does not extend that', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const qs = `w=480&u=${encodeURIComponent(PHOTO)}`;
      await call(qs);
      vi.advanceTimersByTime(4 * 60_000); await call(qs);
      expect(fetch).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(2 * 60_000); await call(qs);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it('never enlarges a photo that is already small', async () => {
    original = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#405746' } }).jpeg().toBuffer();
    const res = await call(`w=960&u=${encodeURIComponent(PHOTO)}`);
    expect((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width).toBe(300);
  });
  it.each([
    ['another host', `w=960&u=${encodeURIComponent('https://evil.example.com/products/x.jpg')}`],
    ['another bucket', `w=960&u=${encodeURIComponent('https://other.s3.ap-south-1.amazonaws.com/products/x.jpg')}`],
    ['outside products/', `w=960&u=${encodeURIComponent(`${BASE}/logos/u/x.png`)}`],
    ['a path trick', `w=960&u=${encodeURIComponent(`${BASE}/products/../secret.jpg`)}`],
    ['an odd width', `w=100000&u=${encodeURIComponent(PHOTO)}`],
    ['no address', 'w=960'],
  ])('answers 404 for %s and fetches nothing', async (_n, qs) => {
    expect((await call(qs)).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('answers 404 when uploads are not set up', async () => {
    vi.stubEnv('S3_BUCKET', '');
    expect((await call(`w=960&u=${encodeURIComponent(PHOTO)}`)).status).toBe(404);
  });
  it('answers 404 when the original cannot be fetched or is too big or is not an image', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 403 })));
    expect((await call(`w=960&u=${encodeURIComponent(PHOTO)}`)).status).toBe(404);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { headers: { 'content-length': String(50 * 1024 * 1024) } })));
    expect((await call(`w=960&u=${encodeURIComponent(PHOTO)}`)).status).toBe(404);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not an image')));
    expect((await call(`w=960&u=${encodeURIComponent(PHOTO)}`)).status).toBe(404);
  });
});

describe('photo-sizes', () => {
  it('only resizes https addresses on amazonaws.com', () => {
    expect(canResize(PHOTO)).toBe(true);
    expect(canResize('https://example.com/a.jpg')).toBe(false);
    expect(canResize('http://bkt.s3.amazonaws.com/a.jpg')).toBe(false);
    expect(canResize('not a url')).toBe(false);
  });
  it('builds an encoded address and a srcset of three widths', () => {
    expect(resizedUrl(PHOTO, 960)).toBe(`/api/photo?w=960&u=${encodeURIComponent(PHOTO)}`);
    expect(resizedSrcSet(PHOTO).split(', ')).toHaveLength(3);
  });
});

describe('load limits', () => {
  const photos = (n: number) => Array.from({ length: n }, (_, i) => `${BASE}/products/load/${PHOTO.length}-${n}-${i}.jpg`);
  const q = (u: string) => `w=480&u=${encodeURIComponent(u)}`;

  it('shares one job between simultaneous requests for the same photo', async () => {
    const calls = await Promise.all(Array.from({ length: 25 }, () => call(q(PHOTO))));
    expect(calls.every(r => r.status === 200)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never works on more than three photos at once, and still answers all of them', async () => {
    let active = 0, peak = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 15));
      active--;
      return new Response(new Uint8Array(original), { headers: { 'content-length': String(original.length) } });
    }));
    const res = await Promise.all(photos(30).map(u => call(q(u))));
    expect(res.every(r => r.status === 200)).toBe(true);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('answers 503 when the line is full, so the page shows the original instead of waiting forever', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { await new Promise(r => setTimeout(r, 40)); return new Response(new Uint8Array(original), { headers: { 'content-length': String(original.length) } }); }));
    const res = await Promise.all(photos(120).map(u => call(q(u))));
    const ok = res.filter(r => r.status === 200).length, busy = res.filter(r => r.status === 503).length;
    expect(ok + busy).toBe(120);
    expect(busy).toBeGreaterThan(0);
    expect(ok).toBeGreaterThanOrEqual(40);
    expect(res.find(r => r.status === 503)!.headers.get('retry-after')).toBe('5');
    // and it recovers once the work has drained
    expect((await call(q(`${BASE}/products/load/after.jpg`))).status).toBe(200);
  });

  it('gives each network address a share of requests per minute', async () => {
    const limited = photoIpLimiter;
    // A client can put anything at the front of X-Forwarded-For; the entry our proxy added at the end is the one that counts.
    let n2 = 0;
    const req = () => GET(new Request(`http://x/api/photo?${q(PHOTO)}`, { headers: { 'x-forwarded-for': `9.9.${n2++ % 250}.${n2 % 250}, 198.51.100.7` } }));
    let blocked = 0;
    for (let i = 0; i < 650; i++) if ((await req()).status === 429) blocked++;
    expect(blocked).toBeGreaterThan(0);
    expect(limited.size()).toBeGreaterThan(0);
  });
});
