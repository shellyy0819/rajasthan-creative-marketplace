import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { POST as postWorkshop } from '@/app/api/workshops/route';
import { PATCH as patchStatus } from '@/app/api/workshops/[id]/status/route';
import { workshopRequests, workshops, users } from '@/db/schema';
import { setMailSenderForTests } from '@/lib/mailer';
import { createWorkshopRequest, listWorkshopRequests } from '@/lib/workshop-requests';
import { listWorkshops } from '@/lib/catalog';
import { getTestDb, resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const asCustomer = () => authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
const req = (method: string, body: unknown) => new Request('http://x/api/x', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const yoga = {
  title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Asha Rao', description: 'Gentle yoga.',
  schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }],
};
const onlineRequest = {
  hostName: 'Asha Yoga', contactName: 'Asha Rao', phone: '99898 98999', email: 'asha@example.com', title: 'Morning Flow', kind: 'class', mode: 'online', description: 'Gentle yoga.',
  startDate: '2099-01-05', platform: 'Zoom', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }],
};

beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); await resetTestDb(); setMailSenderForTests(async () => {}); });

describe('admin listing routes', () => {
  it('only an admin can create a listing or change its status', async () => {
    expect((await postWorkshop(req('POST', yoga))).status).toBe(401);
    expect((await patchStatus(req('PATCH', { status: 'APPROVED' }), ctx('w1'))).status).toBe(401);
    asCustomer();
    expect((await postWorkshop(req('POST', yoga))).status).toBe(403);
    expect((await patchStatus(req('PATCH', { status: 'APPROVED' }), ctx('w1'))).status).toBe(403);
  });
  it('an admin creates a Draft, records themselves as creator, and the status route publishes and archives it', async () => {
    asAdmin();
    const d = await getTestDb();
    const [{ id: adminId }] = await d.insert(users).values({ email: 'root@x.co', name: 'Root' }).returning({ id: users.id });
    const created = await (await postWorkshop(req('POST', yoga))).json();
    expect(created).toMatchObject({ status: 'DRAFT', mode: 'online' });
    expect((await d.select().from(workshops).where(eq(workshops.id, created.id)))[0].createdBy).toBe(adminId);
    expect((await listWorkshops()).map(w => w.id)).not.toContain(created.id);
    expect((await (await patchStatus(req('PATCH', { status: 'APPROVED' }), ctx(created.id))).json()).status).toBe('APPROVED');
    expect((await listWorkshops()).map(w => w.id)).toContain(created.id);
    await patchStatus(req('PATCH', { status: 'ARCHIVED' }), ctx(created.id));
    expect((await listWorkshops()).map(w => w.id)).not.toContain(created.id);
  });
  it('rejects an unknown status and an unknown workshop', async () => {
    asAdmin();
    expect((await patchStatus(req('PATCH', { status: 'LIVE' }), ctx('w1'))).status).toBe(400);
    expect((await patchStatus(req('PATCH', { status: 'APPROVED' }), ctx('w999'))).status).toBe(404);
  });
});

describe('creating a listing from a request', () => {
  it('stores the source request, marks it listed with the new workshop id, and the listing is a Draft', async () => {
    asAdmin();
    const r = await createWorkshopRequest(onlineRequest);
    const d = await getTestDb();
    await d.update(workshopRequests).set({ status: 'received' }).where(eq(workshopRequests.id, r.id));
    const created = await (await postWorkshop(req('POST', { ...yoga, sourceRequestId: r.id }))).json();
    expect(created).toMatchObject({ status: 'DRAFT', sourceRequestId: r.id });
    const [row] = await d.select().from(workshopRequests).where(eq(workshopRequests.id, r.id));
    expect(row).toMatchObject({ status: 'listed', listedWorkshopId: created.id });
    expect((await listWorkshopRequests())[0]).toMatchObject({ id: r.id, status: 'listed', listedWorkshopId: created.id });
  });
  it('an unknown source request is refused and nothing is created', async () => {
    asAdmin();
    const r = await postWorkshop(req('POST', { ...yoga, sourceRequestId: '11111111-1111-4111-8111-111111111111' }));
    expect(r.status).toBe(400);
    expect((await (await getTestDb()).select().from(workshops)).length).toBe(3);
  });
});
