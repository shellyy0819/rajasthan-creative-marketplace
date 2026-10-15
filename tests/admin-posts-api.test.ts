import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { GET as artistsRoute } from '@/app/api/admin/artists/route';
import { GET as listRoute } from '@/app/api/admin/products/route';
import { GET as oneRoute } from '@/app/api/admin/products/[id]/route';
import { GET as publicProducts } from '@/app/api/products/route';
import { createProduct } from '@/lib/admin';

const asCustomer = () => authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const req = (qs = '') => new Request(`http://x/api/admin/products${qs}`);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const calls = () => [() => artistsRoute(), () => listRoute(req()), () => oneRoute(req(), ctx('p1'))];

beforeEach(async () => {
  authMock.mockReset();
  authMock.mockResolvedValue(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrapa-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
  await createProduct({ name: 'Secret Draft', category: 'Accessories', city: 'Jodhpur', pricePaise: 100, seller: 'Marwar Lac', description: 'Hidden.', stock: 1, status: 'DRAFT' });
});

describe('admin read APIs', () => {
  it('401 anonymous, 403 customer — and the body never mentions drafts', async () => {
    for (const c of calls()) {
      const r = await c(); expect(r.status).toBe(401);
      expect(JSON.stringify(await r.json())).not.toContain('Secret Draft');
    }
    asCustomer();
    for (const c of calls()) {
      const r = await c(); expect(r.status).toBe(403);
      expect(JSON.stringify(await r.json())).not.toContain('Secret Draft');
    }
  });
  it('admin sees drafts, no-store header, artist groups', async () => {
    asAdmin();
    const list = await listRoute(req());
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect((await list.json()).map((p: { name: string }) => p.name)).toContain('Secret Draft');
    const artists = await (await artistsRoute()).json();
    expect(artists.find((a: { key: string }) => a.key === 'marwar lac')).toMatchObject({ total: 1, drafts: 1, published: 0 });
  });
  it('status/artist filters, 400 on bad status, 404 on unknown id', async () => {
    asAdmin();
    expect((await (await listRoute(req('?status=DRAFT'))).json())).toHaveLength(1);
    expect((await (await listRoute(req('?artist=MARWAR%20LAC'))).json())).toHaveLength(1);
    expect((await listRoute(req('?status=WHATEVER'))).status).toBe(400);
    expect((await oneRoute(req(), ctx('nope'))).status).toBe(404);
    expect((await oneRoute(req(), ctx('p5'))).status).toBe(200);
  });
  it('public API never returns drafts', async () => {
    const names = (await (await publicProducts(new Request('http://x/api/products'))).json()).map((p: { name: string }) => p.name);
    expect(names).not.toContain('Secret Draft');
  });
});
