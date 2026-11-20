import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), revalidatePath: vi.fn() }));
// the button itself is tested elsewhere: here only whether it is rendered
vi.mock('@/components/ShareButton', () => ({ ShareButton: (p: { path: string }) => <button data-testid="share" data-path={p.path}>Share</button> }));

import { GET, PUT } from '@/app/api/admin/settings/share/route';
import { Share } from '@/components/Share';
import { DEFAULT_SHARE_SETTINGS, canSeeShare, clearShareCache, getShareSettings, saveShareSettings, shareVisibleTo } from '@/lib/share-settings';
import { resetTestDb } from './helpers/testdb';

const as = (role: string, extra: Record<string, unknown> = {}) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role, ...extra } });
const put = (body: unknown) => PUT(new Request('http://x/api/admin/settings/share', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const props = { path: '/products/vase-p1', title: 'Vase', kind: 'product' as const };
const rendered = async () => { const el = await Share(props); return el !== null; };

beforeEach(async () => { await resetTestDb(); authMock.mockReset(); authMock.mockResolvedValue(null); clearShareCache(); });

describe('share settings', () => {
  it('start as admins only: nothing is saved, so the button is hidden from everyone else', async () => {
    expect(DEFAULT_SHARE_SETTINGS).toEqual({ visibility: 'admin' });
    expect(await getShareSettings()).toEqual({ visibility: 'admin' });
  });
  it('saves "everyone" and "admin", keeps who saved it, and rejects anything else (400)', async () => {
    expect(await saveShareSettings({ visibility: 'everyone' }, 'a@x.co')).toEqual({ visibility: 'everyone' });
    expect(await getShareSettings()).toEqual({ visibility: 'everyone' });
    expect(await saveShareSettings({ visibility: 'admin' }, 'a@x.co')).toEqual({ visibility: 'admin' });
    for (const bad of [{ visibility: 'sellers' }, { visibility: true }, {}, { visibility: '' }]) await expect(saveShareSettings(bad, 'a@x.co')).rejects.toMatchObject({ status: 400 });
    await expect(saveShareSettings('x', 'a@x.co')).rejects.toMatchObject({ status: 400 });
  });
  it('a stored value that is not one of the two is read as admins only (never shows the feature by surprise)', async () => {
    const { getDb } = await import('@/db/client'); const { appSettings } = await import('@/db/schema');
    await getDb().insert(appSettings).values({ key: 'share', value: { visibility: 'whoever' }, updatedBy: 'x' });
    expect(await getShareSettings()).toEqual({ visibility: 'admin' });
  });
});

describe('who sees the Share button', () => {
  it('admins only mode: an active admin sees it; customers, sellers, signed-out visitors and a deactivated admin do not', () => {
    const user = (role: string, active?: boolean) => ({ user: { email: 'a@x.co', role: role as never, ...(active === undefined ? {} : { active }) } });
    expect(canSeeShare('admin', user('admin'))).toBe(true);
    expect(canSeeShare('admin', user('seller'))).toBe(false);
    expect(canSeeShare('admin', user('customer'))).toBe(false);
    expect(canSeeShare('admin', null)).toBe(false);
    expect(canSeeShare('admin', user('admin', false))).toBe(false);
  });
  it('everyone mode: everybody sees it, signed in or not', () => {
    expect(canSeeShare('everyone', null)).toBe(true);
    expect(canSeeShare('everyone', { user: { email: 'c@x.co', role: 'customer' } })).toBe(true);
  });
  it('shareVisibleTo reads the saved setting: hidden from a customer until an admin switches it to everyone, and back', async () => {
    expect(await shareVisibleTo(null)).toBe(false);
    expect(await shareVisibleTo({ user: { email: 'r@x.co', role: 'admin' } })).toBe(true);
    await saveShareSettings({ visibility: 'everyone' }, 'r@x.co');
    expect(await shareVisibleTo(null)).toBe(true);
    await saveShareSettings({ visibility: 'admin' }, 'r@x.co');
    expect(await shareVisibleTo(null)).toBe(false);
  });
  it('if the setting cannot be read, the button stays hidden from visitors (fails closed)', async () => {
    const { setDb } = await import('@/db/client');
    const { getTestDb } = await import('./helpers/testdb');
    const real = await getTestDb();
    setDb({ select: () => { throw new Error('db down'); } } as never);
    clearShareCache();
    expect(await shareVisibleTo(null)).toBe(false);
    expect(await shareVisibleTo({ user: { email: 'r@x.co', role: 'admin' } })).toBe(true);   // an admin still sees it
    setDb(real);
  });
});

describe('<Share> (the server gate around the button)', () => {
  it('renders nothing for a signed-out visitor or a customer while the setting is admins only', async () => {
    expect(await rendered()).toBe(false);
    as('customer'); expect(await rendered()).toBe(false);
    as('seller'); expect(await rendered()).toBe(false);
  });
  it('renders the button for an admin while the setting is admins only', async () => {
    as('admin'); expect(await rendered()).toBe(true);
  });
  it('never breaks the page: if the session cannot be read, the button is simply not shown', async () => {
    authMock.mockRejectedValue(new Error('NEXTAUTH_SECRET is not set'));
    expect(await rendered()).toBe(false);
  });
  it('renders it for everybody once an admin saves "everyone"', async () => {
    await saveShareSettings({ visibility: 'everyone' }, 'admin@x.co');
    expect(await rendered()).toBe(true);
    as('customer'); expect(await rendered()).toBe(true);
  });
});

describe('/api/admin/settings/share', () => {
  it('is admin only: 401 signed out, 403 customers and sellers, for read and write', async () => {
    expect((await GET()).status).toBe(401);
    for (const role of ['customer', 'seller']) {
      as(role);
      expect((await GET()).status).toBe(403);
      expect((await put({ visibility: 'everyone' })).status).toBe(403);
    }
    expect(await getShareSettings()).toEqual({ visibility: 'admin' });
  });
  it('an admin reads and saves it; a bad value is 400; responses are never cached', async () => {
    as('admin');
    const read = await GET();
    expect(read.status).toBe(200); expect(read.headers.get('cache-control')).toBe('no-store');
    expect(await read.json()).toEqual({ visibility: 'admin' });
    const saved = await put({ visibility: 'everyone' });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ visibility: 'everyone' });
    expect(await getShareSettings()).toEqual({ visibility: 'everyone' });
    expect((await put({ visibility: 'nobody' })).status).toBe(400);
  });
});
