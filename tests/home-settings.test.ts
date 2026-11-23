import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const reval = vi.hoisted(() => vi.fn());
vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), revalidatePath: reval }));

import { GET, PUT } from '@/app/api/admin/settings/home/route';
import { DEFAULT_HOME_PRODUCT_LIMIT, MAX_HOME_PRODUCT_LIMIT, MIN_HOME_PRODUCT_LIMIT } from '@/lib/catalog-shared';
import { DEFAULT_HOME_SETTINGS, getHomeSettings, saveHomeSettings } from '@/lib/home-settings';
import { resetTestDb } from './helpers/testdb';

const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
const put = (body: unknown) => PUT(new Request('http://x/api/admin/settings/home', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
beforeEach(async () => { await resetTestDb(); authMock.mockReset(); authMock.mockResolvedValue(null); reval.mockClear(); });

describe('home page settings', () => {
  it('start at 30 products: nothing is saved yet', async () => {
    expect(DEFAULT_HOME_SETTINGS).toEqual({ productLimit: 30 });
    expect(DEFAULT_HOME_PRODUCT_LIMIT).toBe(30);
    expect(await getHomeSettings()).toEqual({ productLimit: 30 });
  });
  it('saves a whole number inside the bounds and reads it back', async () => {
    for (const n of [MIN_HOME_PRODUCT_LIMIT, 12, MAX_HOME_PRODUCT_LIMIT]) {
      expect(await saveHomeSettings({ productLimit: n }, 'a@x.co')).toEqual({ productLimit: n });
      expect(await getHomeSettings()).toEqual({ productLimit: n });
    }
  });
  it('rejects anything else with a 400 and keeps the saved value', async () => {
    await saveHomeSettings({ productLimit: 12 }, 'a@x.co');
    for (const bad of [{ productLimit: MIN_HOME_PRODUCT_LIMIT - 1 }, { productLimit: MAX_HOME_PRODUCT_LIMIT + 1 }, { productLimit: 0 }, { productLimit: -5 }, { productLimit: 10.5 }, { productLimit: '12' }, { productLimit: null }, {}])
      await expect(saveHomeSettings(bad, 'a@x.co')).rejects.toMatchObject({ status: 400 });
    await expect(saveHomeSettings('x', 'a@x.co')).rejects.toMatchObject({ status: 400 });
    expect(await getHomeSettings()).toEqual({ productLimit: 12 });
  });
  it('a stored value outside the bounds is read as the default, so it can neither empty the shelf nor flood the page', async () => {
    const { getDb } = await import('@/db/client'); const { appSettings } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    for (const v of [0, 500, 'many', 3.5, null]) {
      await getDb().delete(appSettings).where(eq(appSettings.key, 'home'));
      await getDb().insert(appSettings).values({ key: 'home', value: { productLimit: v }, updatedBy: 'x' });
      expect(await getHomeSettings()).toEqual({ productLimit: 30 });
    }
  });
});

describe('/api/admin/settings/home', () => {
  it('is admin only: 401 signed out, 403 for a seller and a customer, for both GET and PUT', async () => {
    expect((await GET()).status).toBe(401);
    expect((await put({ productLimit: 10 })).status).toBe(401);
    for (const role of ['seller', 'customer']) { as(role); expect((await GET()).status).toBe(403); expect((await put({ productLimit: 10 })).status).toBe(403); }
    expect(await getHomeSettings()).toEqual({ productLimit: 30 });
  });
  it('an admin reads and saves it; saving refreshes the pages so the home page shows the new number', async () => {
    as('admin');
    expect(await (await GET()).json()).toEqual({ productLimit: 30 });
    const r = await put({ productLimit: 16 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ productLimit: 16 });
    expect(reval).toHaveBeenCalledWith('/', 'layout');
    expect(await getHomeSettings()).toEqual({ productLimit: 16 });
  });
  it('a bad number is a 400 and refreshes nothing', async () => {
    as('admin');
    expect((await put({ productLimit: 1000 })).status).toBe(400);
    expect(reval).not.toHaveBeenCalled();
  });
});
