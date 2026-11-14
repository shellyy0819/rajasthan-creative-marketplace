import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { GET } from '@/app/api/photo/route';
import { canResize, resizedSrcSet, resizedUrl } from '@/lib/photo-sizes';

const BASE = 'https://bkt.s3.ap-south-1.amazonaws.com';
const PHOTO = `${BASE}/products/user-1/abc.jpg`;
const call = (qs: string) => GET(new Request(`http://x/api/photo?${qs}`));
const env = { S3_BUCKET: 'bkt', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' };
let original: Buffer;

beforeEach(async () => {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  original = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#c66b43' } }).jpeg().toBuffer();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(original), { headers: { 'content-length': String(original.length) } })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('GET /api/photo', () => {
  it('serves a smaller webp copy of a photo in our bucket, cached for a year', async () => {
    const res = await call(`w=960&u=${encodeURIComponent(PHOTO)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('immutable');
    const out = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(960);
    expect(out.length).toBeLessThan(original.length);
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
