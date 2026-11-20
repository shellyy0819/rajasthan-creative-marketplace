import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; });
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { PATCH as patchRoute, DELETE as deleteRoute } from '@/app/api/workshops/[id]/route';
import { createWorkshop } from '@/lib/admin';
import { listSellerWorkshops, updateOwnWorkshop } from '@/lib/seller-workshops';
import { makeSeller, resetTestDb } from './helpers/testdb';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown) => new Request('http://x/api/x', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const base = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 } };
const asSeller = (email: string) => authMock.mockResolvedValue({ user: { email, role: 'seller' } });

describe('a seller\'s own workshops', () => {
  beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); await resetTestDb(); });

  it('lists the workshops linked to their account or made with their account email, and no one else\'s', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati');
    await makeSeller('other@x.co', 'Other');
    const byHost = await createWorkshop({ ...base, title: 'By host id', hostId: swati.id });
    const byEmail = await createWorkshop({ ...base, title: 'By email', contactEmail: 'Swati@X.co' });
    await createWorkshop({ ...base, title: 'Not mine', contactEmail: 'other@x.co' });
    await createWorkshop({ ...base, title: 'Same name only', host: 'Swati' });
    const mine = await listSellerWorkshops('swati@x.co');
    expect(mine.map(w => w.id).sort()).toEqual([byHost.id, byEmail.id].sort());
  });

  it('edits their own workshop but cannot change its status, host link or source request', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati');
    const other = await makeSeller('other@x.co', 'Other');
    const w = await createWorkshop({ ...base, hostId: swati.id, status: 'APPROVED' });
    const updated = await updateOwnWorkshop(w.id, { title: 'Evening Flow', status: 'DRAFT', hostId: other.id }, 'swati@x.co');
    expect(updated.title).toBe('Evening Flow');
    expect(updated.status).toBe('APPROVED');
    expect(updated.hostId).toBe(swati.id);
  });

  it('cannot touch someone else\'s workshop: 404, and nothing changes', async () => {
    await makeSeller('swati@x.co', 'Swati');
    const w = await createWorkshop({ ...base, contactEmail: 'other@x.co' });
    await expect(updateOwnWorkshop(w.id, { title: 'Hijacked' }, 'swati@x.co')).rejects.toMatchObject({ status: 404 });
    expect((await listSellerWorkshops('other@x.co'))[0].title).toBe('Morning Flow');
  });

  it('the PATCH route: a seller edits their own, an admin edits any, a customer and the signed-out are refused, and delete stays admin only', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati');
    const w = await createWorkshop({ ...base, hostId: swati.id, status: 'APPROVED' });
    expect((await patchRoute(patch({ title: 'X' }), ctx(w.id))).status).toBe(401);
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
    expect((await patchRoute(patch({ title: 'X' }), ctx(w.id))).status).toBe(403);
    asSeller('other@x.co');
    expect((await patchRoute(patch({ title: 'X' }), ctx(w.id))).status).toBe(404);
    asSeller('swati@x.co');
    const r = await patchRoute(patch({ title: 'Mine now', status: 'ARCHIVED' }), ctx(w.id));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ title: 'Mine now', status: 'APPROVED' });
    expect((await deleteRoute(new Request('http://x'), ctx(w.id))).status).toBe(403);
    authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
    const a = await patchRoute(patch({ status: 'ARCHIVED' }), ctx(w.id));
    expect((await a.json()).status).toBe('ARCHIVED');
  });
});
