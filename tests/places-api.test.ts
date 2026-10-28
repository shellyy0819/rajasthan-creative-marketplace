import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const searchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/places', () => ({ searchPlaces: searchMock }));

import { GET, resetPlacesRateLimit } from '@/app/api/places/route';
import { ApiError } from '@/lib/errors';

const get = (q?: string) => GET(new Request(`http://x/api/places${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`));
const as = (role: string, email = `${role}@x.co`) => authMock.mockResolvedValue({ user: { email, role } });

beforeEach(() => { authMock.mockReset(); searchMock.mockReset(); searchMock.mockResolvedValue([{ label: 'Udaipur, Rajasthan', name: 'Udaipur', state: 'Rajasthan' }]); resetPlacesRateLimit(); authMock.mockResolvedValue(null); });

describe('GET /api/places', () => {
  it('401 anonymous, 403 customers and deactivated users; upstream is never called', async () => {
    expect((await get('udai')).status).toBe(401);
    as('customer');
    expect((await get('udai')).status).toBe(403);
    authMock.mockResolvedValue({ user: { email: 's@x.co', role: 'seller', active: false } });
    expect((await get('udai')).status).toBe(403);
    expect(searchMock).not.toHaveBeenCalled();
  });
  it('sellers and admins get suggestions with a short private cache header', async () => {
    for (const role of ['seller', 'admin']) {
      as(role);
      const r = await get('udai');
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual([{ label: 'Udaipur, Rajasthan', name: 'Udaipur', state: 'Rajasthan' }]);
      expect(r.headers.get('cache-control')).toMatch(/^private/);
    }
    expect(searchMock).toHaveBeenCalledWith('udai');
  });
  it('type=city asks for city-only results', async () => {
    as('seller');
    await GET(new Request('http://x/api/places?q=udai&type=city'));
    expect(searchMock).toHaveBeenCalledWith('udai', undefined, { cityOnly: true });
  });
  it('missing or one-character q returns [] without calling the service', async () => {
    as('seller');
    for (const q of [undefined, '', ' ', 'u']) expect(await (await get(q)).json()).toEqual([]);
    expect(searchMock).not.toHaveBeenCalled();
  });
  it('passes odd input through untouched (the service encodes it) and returns 502 when the service is down', async () => {
    as('seller');
    await get('a&bbox=0,0,1,1#x');
    expect(searchMock).toHaveBeenCalledWith('a&bbox=0,0,1,1#x');
    searchMock.mockRejectedValueOnce(new ApiError(502, 'Place search is unavailable.'));
    const r = await get('udai');
    expect(r.status).toBe(502);
    expect((await r.json()).error).toBe('Place search is unavailable.');
  });
  it('rate-limits each user to 60 lookups a minute (429), independently per user', async () => {
    as('seller', 'a@x.co');
    for (let i = 0; i < 60; i++) expect((await get(`udai${i}`)).status).toBe(200);
    expect((await get('udai')).status).toBe(429);
    as('seller', 'b@x.co');
    expect((await get('udai')).status).toBe(200);
  });
});
