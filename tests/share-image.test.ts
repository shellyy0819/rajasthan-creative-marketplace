import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { hasSharePhoto, shareImage, SHARE_H, SHARE_MAX_BYTES, SHARE_W } from '@/lib/share-image';

const ENV = { S3_BUCKET: 'b', S3_REGION: 'r' };
const U = 'https://b.s3.r.amazonaws.com/products/u/a.png';
/** A large, hard-to-compress picture (a gradient with noise) as a JPEG of a few MB: the size of a real phone photo, under our 5 MB upload limit. */
const noisy = async (w = 2400, h = 1600) => {
  const raw = Buffer.alloc(w * h * 3); const r = randomBytes(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = ((((i / 3) | 0) % w) / w * 200 + (((i / 3 / w) | 0) / h) * 40 + (r[i] % 24)) & 255;
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
};
const resp = (buf: Buffer, type = 'image/png') => new Response(new Uint8Array(buf), { headers: { 'content-type': type } });

describe('hasSharePhoto', () => {
  it('is true only for a first photo in our own storage', () => {
    expect(hasSharePhoto({ images: [U] }, ENV)).toBe(true);
    expect(hasSharePhoto({ images: ['https://evil.example/a.png'] }, ENV)).toBe(false);
    expect(hasSharePhoto({}, ENV)).toBe(false);
    expect(hasSharePhoto({ images: [U] }, {})).toBe(false);
  });
});

describe('shareImage: a small copy for link previews, made only on request', () => {
  it('turns a big photo into a 1200x630 JPEG under the size WhatsApp accepts, showing the whole picture', async () => {
    const src = await noisy();
    expect(src.byteLength).toBeGreaterThan(500_000);
    expect(src.byteLength).toBeLessThan(5 * 1024 * 1024);
    const out = await shareImage({ images: [U] }, ENV, (async () => resp(src, 'image/jpeg')) as never);
    expect(out).not.toBeNull();
    expect(out!.byteLength).toBeLessThanOrEqual(SHARE_MAX_BYTES);
    const meta = await sharp(out!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', SHARE_W, SHARE_H]);
  }, 30_000);
  it('keeps a portrait photo whole (padded, not cropped)', async () => {
    const src = await sharp({ create: { width: 600, height: 1200, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const out = await shareImage({ images: [U] }, ENV, (async () => resp(src)) as never);
    const { data, info } = await sharp(out!).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [data[(y * info.width + x) * info.channels], data[(y * info.width + x) * info.channels + 1]];
    expect(px(600, 5)[0]).toBeGreaterThan(200);        // centre column reaches the top and bottom edge: not cropped
    expect(px(10, 300)[1]).toBeGreaterThan(200);       // left side is cream padding, not photo
  });
  it('fetches only our own storage, without following redirects', async () => {
    const f = vi.fn(async () => resp(await noisy(50, 50)));
    expect(await shareImage({ images: ['http://169.254.169.254/x.png', 'https://evil.example/a.png'] }, ENV, f as never)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    await shareImage({ images: [U] }, ENV, f as never);
    expect(f).toHaveBeenCalledWith(U, expect.objectContaining({ redirect: 'error' }));
  });
  it('is null when the photo is missing, not an image, too big, corrupt, or the fetch throws', async () => {
    expect(await shareImage({ images: [U] }, ENV, (async () => new Response('', { status: 404 })) as never)).toBeNull();
    expect(await shareImage({ images: [U] }, ENV, (async () => resp(Buffer.from('x'), 'text/html')) as never)).toBeNull();
    expect(await shareImage({ images: [U] }, ENV, (async () => resp(Buffer.from('not an image'))) as never)).toBeNull();
    expect(await shareImage({ images: [U] }, ENV, (async () => { throw new Error('net'); }) as never)).toBeNull();
    expect(await shareImage({ images: [U] }, ENV, (async () => resp(Buffer.alloc(5 * 1024 * 1024 + 1))) as never)).toBeNull();
  });
});
