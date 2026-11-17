import { describe, it, expect, vi } from 'vitest';
import { fetchProductPhotos, photoBase, MAX_ATTACHED } from '@/lib/enquiry-photos';

const ENV = { S3_BUCKET: 'b', S3_REGION: 'r' };
const BASE = 'https://b.s3.r.amazonaws.com';
const img = (type = 'image/jpeg', bytes = 10) => new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': type } });

describe('photoBase', () => {
  it('is the public storage address, from S3_PUBLIC_BASE_URL or the bucket and region', () => {
    expect(photoBase(ENV)).toBe(BASE);
    expect(photoBase({ ...ENV, S3_PUBLIC_BASE_URL: 'https://cdn.example.com/' })).toBe('https://cdn.example.com');
  });
  it('is null when storage is not configured or is not https', () => {
    expect(photoBase({})).toBeNull();
    expect(photoBase({ S3_PUBLIC_BASE_URL: 'http://cdn.example.com' })).toBeNull();
  });
});

describe('fetchProductPhotos', () => {
  it('downloads our own photos and names them after the product', async () => {
    const f = vi.fn(async () => img('image/png'));
    const r = await fetchProductPhotos([`${BASE}/products/u/a.png`, `${BASE}/products/u/b.png`], 'Blue Vase!', ENV, f as never);
    expect(r.map(p => p.filename)).toEqual(['blue-vase-1.png', 'blue-vase-2.png']);
    expect(r[0].contentType).toBe('image/png');
    expect(f).toHaveBeenCalledWith(`${BASE}/products/u/a.png`, expect.objectContaining({ redirect: 'error' }));
  });
  it('never fetches an address outside our storage (no server-side requests to arbitrary hosts)', async () => {
    const f = vi.fn(async () => img());
    const r = await fetchProductPhotos(['http://169.254.169.254/latest', 'https://evil.example/x.jpg', `${BASE}.evil.example/x.jpg`, `${BASE}@evil.example/x.jpg`], 'v', ENV, f as never);
    expect(r).toEqual([]); expect(f).not.toHaveBeenCalled();
  });
  it('does nothing when storage is not configured', async () => {
    const f = vi.fn();
    expect(await fetchProductPhotos([`${BASE}/a.jpg`], 'v', {}, f as never)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  it('leaves out a photo that is missing, not an image, too big, empty, or that throws; keeps the rest', async () => {
    const responses = [new Response('', { status: 404 }), img('text/html'), img('image/jpeg', 5 * 1024 * 1024 + 1), img('image/jpeg', 0), 'throw', img('image/webp', 5)] as const;
    let i = 0;
    const f = vi.fn(async () => { const x = responses[i++]; if (x === 'throw') throw new Error('network'); return x; });
    const urls = Array.from({ length: 6 }, (_, k) => `${BASE}/p/${k}.jpg`);
    const r = await fetchProductPhotos(urls.slice(0, 5).concat([]), 'v', ENV, f as never);
    expect(r).toEqual([]);                       // only the first 5 are tried: all five fail
    const r2 = await fetchProductPhotos([`${BASE}/p/5.webp`], 'v', ENV, (async () => img('image/webp', 5)) as never);
    expect(r2.map(p => p.filename)).toEqual(['v-1.webp']);
  });
  it(`attaches at most ${MAX_ATTACHED} photos`, async () => {
    const f = vi.fn(async () => img());
    const r = await fetchProductPhotos(Array.from({ length: 9 }, (_, k) => `${BASE}/p/${k}.jpg`), 'v', ENV, f as never);
    expect(r).toHaveLength(MAX_ATTACHED); expect(f).toHaveBeenCalledTimes(MAX_ATTACHED);
  });
  it('keeps the total under the size cap', async () => {
    const f = vi.fn(async () => img('image/jpeg', 4 * 1024 * 1024));
    const r = await fetchProductPhotos(Array.from({ length: 5 }, (_, k) => `${BASE}/p/${k}.jpg`), 'v', ENV, f as never);
    expect(r).toHaveLength(3);                   // 3 x 4 MB = 12 MB
  });
});
