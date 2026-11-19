import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; process.env.ADMIN_EMAILS = 'boss@x.co'; });
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { POST as verifyRoute } from '@/app/api/workshop-requests/verify/route';
import { listWorkshops } from '@/lib/catalog';
import { listAdminWorkshops } from '@/lib/catalog';
import { setMailSenderForTests } from '@/lib/mailer';
import { listWorkshopRequests, createWorkshopRequest } from '@/lib/workshop-requests';
import { cityRef } from './helpers/cities';
import { giveRole, makeSeller, resetTestDb } from './helpers/testdb';

let lastCode = '';
let mails: unknown[] = [];
beforeEach(async () => {
  await resetTestDb(); mails = [];
  setMailSenderForTests(async m => { mails.push(m); });
});

const online = (email: string) => ({
  hostName: 'Swati Yoga', contactName: 'Swati', phone: '9989898999', email, title: 'Morning Flow', kind: 'class', mode: 'online',
  description: 'Gentle yoga.', startDate: '2027-01-05', platform: 'Zoom', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, instagram: '@swati', phonePublic: true,
});
const inPerson = (email: string, city = 'Jodhpur') => ({
  hostName: 'Clay Studio', contactName: 'Swati', phone: '9989898999', email, title: 'Clay day', kind: 'workshop', mode: 'in_person', description: 'Bowls.',
  startDate: '2027-02-05', startTime: '10:00', cityRef: cityRef(city), venue: 'Studio 9', seats: 12, priceType: 'FREE',
});
/** Create the request, read the 6-digit code from the email, and confirm it through the real route. */
async function confirm(input: Record<string, unknown>) {
  const r = await createWorkshopRequest(input);
  const code = /\b(\d{6})\b/.exec(JSON.stringify(mails.at(-1)))?.[1];
  expect(code, 'the code email').toBeTruthy();
  const res = await verifyRoute(new Request('http://x/api/workshop-requests/verify', { method: 'POST', body: JSON.stringify({ id: r.id, code }), headers: { 'content-type': 'application/json' } }));
  expect(res.status).toBe(200);
  lastCode = code!;
  return r.id;
}
const requestOf = async (id: string) => (await listWorkshopRequests()).find(x => x.id === id)!;

describe('a seller\'s confirmed workshop request becomes a Draft listing of their own', () => {
  it('an online class: Draft, linked to the seller, request marked listed, nothing public yet', async () => {
    const s = await makeSeller('swati@x.co', 'Swati');
    const id = await confirm(online('swati@x.co'));
    const req = await requestOf(id);
    expect(req.status).toBe('listed');
    const w = (await listAdminWorkshops()).find(x => x.id === req.listedWorkshopId)!;
    expect(w).toMatchObject({ status: 'DRAFT', hostId: s.id, sourceRequestId: id, title: 'Morning Flow', host: 'Swati Yoga', contactEmail: 'swati@x.co', phonePublic: true, kind: 'class' });
    expect((await listWorkshops()).some(x => x.id === w.id)).toBe(false);
  });
  it('an in-person event in a known city is drafted too', async () => {
    const s = await makeSeller('swati@x.co', 'Swati');
    const id = await confirm(inPerson('swati@x.co'));
    const req = await requestOf(id);
    const w = (await listAdminWorkshops()).find(x => x.id === req.listedWorkshopId)!;
    expect(w).toMatchObject({ status: 'DRAFT', hostId: s.id, venue: 'Studio 9', seats: 12, mode: 'in_person' });
    expect(w.city).toBe('Jodhpur');
  });
  it('someone with no seller account gets the request only, as before', async () => {
    const id = await confirm(online('nobody@x.co'));
    expect(await requestOf(id)).toMatchObject({ status: 'received' });
    expect((await listAdminWorkshops()).some(x => x.sourceRequestId === id)).toBe(false);
  });
  it('an admin\'s request is not drafted for them: the team lists it', async () => {
    await giveRole('boss@x.co', 'seller');
    const id = await confirm(online('boss@x.co'));
    expect(await requestOf(id)).toMatchObject({ status: 'received' });
  });
  it('a customer account (no seller role) is not drafted either', async () => {
    await giveRole('cust@x.co', 'customer');
    const id = await confirm(online('cust@x.co'));
    expect(await requestOf(id)).toMatchObject({ status: 'received' });
  });
  it('confirming again does not make a second listing', async () => {
    await makeSeller('swati@x.co', 'Swati');
    const id = await confirm(online('swati@x.co'));
    await verifyRoute(new Request('http://x', { method: 'POST', body: JSON.stringify({ id, code: lastCode }), headers: { 'content-type': 'application/json' } }));
    expect((await listAdminWorkshops()).filter(x => x.sourceRequestId === id)).toHaveLength(1);
  });
});
