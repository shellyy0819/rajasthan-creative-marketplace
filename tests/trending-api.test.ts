import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/trending/route';
import { likeProduct, recordEvent } from '@/lib/engagement';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const get = (qs = '') => GET(new Request(`http://x/api/trending${qs}`));

describe('GET /api/trending', () => {
  it('is public, cacheable at the edge for 5 minutes, and an empty list when nothing trends', async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([]);
    expect(r.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=600');
  });
  it('returns public products ranked, with likeCount and sellerSlug and without any private data', async () => {
    await recordEvent({ productId: 'p3', type: 'view', actor: 'h:a' }); await likeProduct('p3', 'v:a');
    const list = await (await get()).json();
    expect(list.map((p: { id: string }) => p.id)).toEqual(['p3']);
    expect(list[0]).toMatchObject({ likeCount: 1, sellerSlug: expect.stringMatching(/^petal-and-pour-[0-9a-f]{8}$/) });
    const text = JSON.stringify(list);
    for (const secret of ['sellerId', 'sellerEmail', 'seed.rangrajasthan', 'h:a', 'v:a', 'pickupLocation']) expect(text).not.toContain(secret);
  });
  it('limit: default 6, clamped to 1..24, garbage ignored', async () => {
    for (const p of ['p1', 'p2', 'p3', 'p4']) await recordEvent({ productId: p, type: 'contact', actor: 'h:a' });
    expect((await (await get('?limit=2')).json()).length).toBe(2);
    expect((await (await get('?limit=abc')).json()).length).toBe(4);
    expect((await (await get('?limit=-1')).json()).length).toBe(1);
    expect((await (await get('?limit=999')).json()).length).toBe(4);
  });
});
