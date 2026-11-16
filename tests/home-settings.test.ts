import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET, PUT } from '@/app/api/admin/settings/home/route';
import { getHomeSettings, saveHomeSettings } from '@/lib/home-settings';
import { DEFAULT_HOME_SETTINGS, MAKERS_ROTATE_MAX_SECONDS, MAKERS_ROTATE_MIN_SECONDS, validRotateSeconds } from '@/lib/home-settings-shared';
import { getDb } from '../src/db/client';
import { appSettings } from '../src/db/schema';
import { resetTestDb } from './helpers/testdb';

const put = (body: unknown) => new Request('http://x/api', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
beforeEach(async () => { await resetTestDb(); authMock.mockReset(); authMock.mockResolvedValue(null); });

describe('the carousel time', () => {
  it('is five seconds until an admin changes it', async () => { expect(await getHomeSettings()).toEqual({ makersRotateSeconds: 5 }); expect(DEFAULT_HOME_SETTINGS.makersRotateSeconds).toBe(5); });
  it('accepts whole seconds from 2 to 60 only', () => {
    for (const ok of [MAKERS_ROTATE_MIN_SECONDS, 5, 30, MAKERS_ROTATE_MAX_SECONDS]) expect(validRotateSeconds(ok)).toBe(true);
    for (const no of [0, 1, 61, 2.5, -3, NaN, '5', null, undefined]) expect(validRotateSeconds(no)).toBe(false);
  });
  it('is saved and read back, and the last save wins', async () => {
    expect(await saveHomeSettings({ makersRotateSeconds: 12 }, 'a@x.co')).toEqual({ makersRotateSeconds: 12 });
    expect(await getHomeSettings()).toEqual({ makersRotateSeconds: 12 });
    await saveHomeSettings({ makersRotateSeconds: 3 }, 'a@x.co');
    expect(await getHomeSettings()).toEqual({ makersRotateSeconds: 3 });
  });
  it('falls back to the default when the saved row is not usable', async () => {
    await getDb().insert(appSettings).values({ key: 'home', value: { makersRotateSeconds: 'soon' }, updatedBy: 'a@x.co' });
    expect(await getHomeSettings()).toEqual({ makersRotateSeconds: 5 });
  });
});

describe('/api/admin/settings/home', () => {
  it('is for admins only', async () => {
    expect((await GET()).status).toBe(401);
    for (const role of ['customer', 'seller']) { as(role); expect((await GET()).status).toBe(403); expect((await PUT(put({ makersRotateSeconds: 9 }))).status).toBe(403); }
    expect(await getHomeSettings()).toEqual({ makersRotateSeconds: 5 });
  });
  it('saves, reads back and rejects anything else with a message', async () => {
    as('admin');
    expect((await PUT(put({ makersRotateSeconds: 8 }))).status).toBe(200);
    expect(await (await GET()).json()).toEqual({ makersRotateSeconds: 8 });
    for (const body of [{}, { makersRotateSeconds: 1 }, { makersRotateSeconds: 61 }, { makersRotateSeconds: 4.5 }, { makersRotateSeconds: '6' }]) {
      const res = await PUT(put(body)); expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toMatch(/makersRotateSeconds/);
    }
    expect(await getHomeSettings()).toEqual({ makersRotateSeconds: 8 });
  });
});
