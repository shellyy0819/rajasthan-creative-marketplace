import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { PATCH as patchStatus } from '@/app/api/workshop-requests/[id]/status/route';
import { workshopRequests } from '@/db/schema';
import { setMailSenderForTests } from '@/lib/mailer';
import { createWorkshop } from '@/lib/admin';
import { createWorkshopRequest, listWorkshopRequests, setRequestStatus } from '@/lib/workshop-requests';
import { getTestDb, resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const req = (body: unknown) => new Request('http://x/api/x', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const online = { hostName: 'Asha', contactName: 'Asha', phone: '99898 98999', email: 'a@b.co', title: 'Flow', kind: 'class', mode: 'online', description: 'd', startDate: '2099-01-05', platform: 'Zoom', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, whatsapp: '9989898999' };
const received = async () => {
  const r = await createWorkshopRequest(online);
  await (await getTestDb()).update(workshopRequests).set({ status: 'received' }).where(eq(workshopRequests.id, r.id));
  return r.id;
};

beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); await resetTestDb(); setMailSenderForTests(async () => {}); });

describe('request status', () => {
  it('an admin can put a request On hold or Archive it, and the list keeps showing it with that status', async () => {
    const id = await received();
    expect((await setRequestStatus(id, 'on_hold')).status).toBe('on_hold');
    expect((await listWorkshopRequests()).find(r => r.id === id)?.status).toBe('on_hold');
    expect((await setRequestStatus(id, 'archived')).status).toBe('archived');
    expect((await listWorkshopRequests()).find(r => r.id === id)?.status).toBe('archived');
    expect((await setRequestStatus(id, 'received')).status).toBe('received'); // back to New
  });
  it('a request that was never confirmed by email cannot be moved, and an unknown one is a 404', async () => {
    const r = await createWorkshopRequest(online); // unverified
    await expect(setRequestStatus(r.id, 'on_hold')).rejects.toMatchObject({ status: 409 });
    await expect(setRequestStatus('11111111-1111-4111-8111-111111111111', 'on_hold')).rejects.toMatchObject({ status: 404 });
  });
  it('a request that already became a listing is managed through its listing, not here', async () => {
    const id = await received();
    await createWorkshop({ title: 'Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Asha', description: 'd', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, sourceRequestId: id });
    await expect(setRequestStatus(id, 'on_hold')).rejects.toMatchObject({ status: 409 });
  });
  it('a listed request carries its listing status, so the dropdown can show it', async () => {
    const id = await received();
    const w = await createWorkshop({ title: 'Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Asha', description: 'd', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, sourceRequestId: id, status: 'APPROVED' });
    const r = (await listWorkshopRequests()).find(x => x.id === id)!;
    expect(r).toMatchObject({ status: 'listed', listedWorkshopId: w.id, listedStatus: 'APPROVED' });
  });
  it('the route is admin only and accepts only received, on_hold and archived', async () => {
    const id = await received();
    expect((await patchStatus(req({ status: 'on_hold' }), ctx(id))).status).toBe(401);
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
    expect((await patchStatus(req({ status: 'on_hold' }), ctx(id))).status).toBe(403);
    asAdmin();
    expect((await patchStatus(req({ status: 'listed' }), ctx(id))).status).toBe(400);
    expect((await patchStatus(req({ status: 'published' }), ctx(id))).status).toBe(400);
    const ok = await patchStatus(req({ status: 'archived' }), ctx(id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe('archived');
  });
});
