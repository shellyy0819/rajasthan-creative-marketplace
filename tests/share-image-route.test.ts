import { describe, it, expect, vi, beforeEach } from 'vitest';
const getProductBySlug = vi.fn();
vi.mock('@/lib/catalog', () => ({ getProductBySlug: (...a: unknown[]) => getProductBySlug(...a) }));
const shareImage = vi.fn();
vi.mock('@/lib/share-image', () => ({ shareImage: (...a: unknown[]) => shareImage(...a) }));
import { GET } from '@/app/products/[slug]/share-image/route';

const call = () => GET(new Request('http://x/products/vase-p1/share-image'), { params: Promise.resolve({ slug: 'vase-p1' }) });
beforeEach(() => { getProductBySlug.mockReset(); shareImage.mockReset(); });

describe('share-image route', () => {
  it('serves the small JPEG, cacheable', async () => {
    getProductBySlug.mockResolvedValue({ id: 'p1' }); shareImage.mockResolvedValue(Buffer.from([1, 2, 3]));
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/jpeg');
    expect(r.headers.get('cache-control')).toMatch(/public.*s-maxage/);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
  it('404s for an unknown product or one without a usable photo', async () => {
    getProductBySlug.mockResolvedValue(undefined);
    expect((await call()).status).toBe(404);
    getProductBySlug.mockResolvedValue({ id: 'p1' }); shareImage.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
});
