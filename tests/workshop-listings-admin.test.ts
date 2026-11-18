import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; }); // the signed city in the fixtures must be made with the key the server checks with, whichever file ran before
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 }); // DB-backed tests run slowly when the whole suite runs in parallel
import { eq } from 'drizzle-orm';
import { createWorkshop, updateWorkshop } from '@/lib/admin';
import { getWorkshopBySlug, listAdminWorkshops, listWorkshops } from '@/lib/catalog';
import { createBooking } from '@/lib/orders';
import { createWorkshopRequest } from '@/lib/workshop-requests';
import { setMailSenderForTests } from '@/lib/mailer';
import { workshopSlug } from '@/lib/catalog-shared';
import { isCurrent } from '@/lib/workshop-listing';
import { workshopPrices, workshops, users } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

const ymd = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
const inPerson = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.' };
const yoga = {
  joinLink: 'https://zoom.us/j/123456',
  title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: ymd(1), host: 'Asha Rao', description: 'Gentle hatha yoga.',
  schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 }, languages: ['Hindi', 'English'], level: 'beginner', freeTrial: true,
  whatsapp: '9989898999', instagram: '@asha.yoga', contactName: 'Asha Rao', contactPhone: '9989898999', contactEmail: 'asha@example.com',
  prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }, { label: 'Per session', amountPaise: 50000, sessions: 1 }],
};

process.env.NEXTAUTH_SECRET = 'test-secret';
const aRequest = async () => (await createWorkshopRequest({ hostName: 'Asha', contactName: 'Asha', phone: '9989898999', email: 'a@b.co', title: 'T', kind: 'class', mode: 'online', description: 'd', startDate: '2099-01-05', whatsapp: '9989898999', platform: 'Zoom', schedule: { days: ['mon'], time: '07:00', durationMin: 60 } })).id;
beforeEach(async () => { await resetTestDb(); setMailSenderForTests(async () => {}); });

describe('createWorkshop: online classes and drafts', () => {
  it('creates an online class with no city, venue or seats, as a Draft, with ordered price rows', async () => {
    const w = await createWorkshop(yoga);
    expect(w).toMatchObject({ status: 'DRAFT', mode: 'online', kind: 'class', city: null, cityId: null, venue: null, seats: null, platform: 'Zoom', type: 'PAID', pricePaise: 50000, level: 'beginner', freeTrial: true, whatsapp: '+919989898999' });
    expect(w.languages).toEqual(['Hindi', 'English']);
    expect(w.prices).toEqual([{ label: 'Monthly', amountPaise: 150000, sessions: 12 }, { label: 'Per session', amountPaise: 50000, sessions: 1 }]);
    expect(w).toMatchObject({ contactName: 'Asha Rao', contactPhone: '+919989898999', contactEmail: 'asha@example.com' });
  });
  it('an in-person listing without a city is still rejected', async () => {
    await expect(createWorkshop({ ...inPerson, cityRef: undefined })).rejects.toMatchObject({ status: 400, message: 'city is required.' });
  });
  it('an in-person listing still needs a venue and seats', async () => {
    await expect(createWorkshop({ ...inPerson, venue: undefined })).rejects.toMatchObject({ status: 400 });
    await expect(createWorkshop({ ...inPerson, seats: undefined })).rejects.toMatchObject({ status: 400 });
  });
  it('defaults to DRAFT and accepts an explicit status', async () => {
    expect((await createWorkshop(inPerson)).status).toBe('DRAFT');
    expect((await createWorkshop({ ...inPerson, status: 'APPROVED' })).status).toBe('APPROVED');
  });
  it('records who added it and the request it came from', async () => {
    const [u] = await (await getTestDb()).select().from(users).limit(1);
    const rid = await aRequest();
    const w = await createWorkshop({ ...yoga, sourceRequestId: rid }, u.email);
    expect(w).toMatchObject({ createdBy: u.id, sourceRequestId: rid });
  });
  it('derives FREE/0 when every price row is zero', async () => {
    expect(await createWorkshop({ ...yoga, prices: [{ label: 'Trial', amountPaise: 0, sessions: 1 }] })).toMatchObject({ type: 'FREE', pricePaise: 0 });
  });
});

describe('updateWorkshop', () => {
  it('replaces the price rows when prices are sent and leaves them alone otherwise', async () => {
    const w = await createWorkshop(yoga);
    const next = await updateWorkshop(w.id, { prices: [{ label: 'Quarterly', amountPaise: 400000, sessions: 36 }] });
    expect(next.prices).toEqual([{ label: 'Quarterly', amountPaise: 400000, sessions: 36 }]);
    expect(next).toMatchObject({ type: 'PAID', pricePaise: 400000 });
    const rows = await (await getTestDb()).select().from(workshopPrices).where(eq(workshopPrices.workshopId, w.id));
    expect(rows).toHaveLength(1);
    expect((await updateWorkshop(w.id, { title: 'Evening Flow' })).prices).toHaveLength(1);
  });
  it('can publish a draft and the seats rule still holds', async () => {
    const w = await createWorkshop(inPerson);
    expect((await updateWorkshop(w.id, { status: 'APPROVED' })).status).toBe('APPROVED');
    await expect(updateWorkshop('w1', { seats: 2 })).rejects.toMatchObject({ status: 400 });
  });
});

describe('catalog: public lists show only published, current listings', () => {
  it('a Draft is not listed, a Published one is', async () => {
    const d = await createWorkshop(inPerson);
    expect((await listWorkshops()).map(w => w.id)).not.toContain(d.id);
    await updateWorkshop(d.id, { status: 'APPROVED' });
    expect((await listWorkshops()).map(w => w.id)).toContain(d.id);
  });
  it('an ended listing leaves the list but its page still resolves; a draft does not', async () => {
    const ended = await createWorkshop({ ...inPerson, date: ymd(-2), status: 'APPROVED' });
    const draft = await createWorkshop({ ...inPerson, date: ymd(-2) });
    expect((await listWorkshops()).map(w => w.id)).not.toContain(ended.id);
    const page = await getWorkshopBySlug(workshopSlug(ended));
    expect(page).toBeDefined();
    expect(isCurrent(page!)).toBe(false);
    expect(await getWorkshopBySlug(workshopSlug(draft))).toBeUndefined();
  });
  it('an open-ended class stays listed even when it started long ago', async () => {
    const c = await createWorkshop({ ...yoga, date: '2025-01-06', status: 'APPROVED' });
    expect((await listWorkshops()).map(w => w.id)).toContain(c.id);
  });
  it('the mode filter splits online from in person; online listings have no city so a city filter excludes them', async () => {
    const online = await createWorkshop({ ...yoga, status: 'APPROVED' });
    expect((await listWorkshops({ mode: 'online' })).map(w => w.id)).toEqual([online.id]);
    expect((await listWorkshops({ mode: 'in_person' })).map(w => w.id)).not.toContain(online.id);
    expect((await listWorkshops({ city: 'jodhpur' })).map(w => w.id)).not.toContain(online.id);
  });
  it('listAdminWorkshops returns every status, newest first, with the admin-only fields', async () => {
    const a = await createWorkshop(yoga);
    const all = await listAdminWorkshops();
    expect(all[0].id).toBe(a.id);
    expect(all.map(w => w.status)).toContain('DRAFT');
    expect(all[0]).toMatchObject({ contactPhone: '+919989898999' });
  });
  it('the fixture workshops still list (they are published and far in the future)', async () => {
    expect((await listWorkshops()).map(w => w.id)).toEqual(['w1', 'w2', 'w3']);
  });
});

describe('public shape never carries admin-only fields', () => {
  it('listWorkshops and getWorkshopBySlug omit contact details, creator and source request', async () => {
    const c = await createWorkshop({ ...yoga, status: 'APPROVED', sourceRequestId: await aRequest() });
    const listed = (await listWorkshops()).find(w => w.id === c.id)!;
    const paged = (await getWorkshopBySlug(workshopSlug(c)))!;
    for (const w of [listed, paged]) {
      const j = JSON.stringify(w);
      for (const k of ['contactName', 'contactPhone', 'contactEmail', 'createdBy', 'sourceRequestId', 'hostId', 'joinLink', 'zoom.us']) expect(j).not.toContain(k);
      expect(w.whatsapp).toBe('+919989898999'); // the public contact is the WhatsApp number, not the private phone
    }
  });
});

describe('booking', () => {
  it('a class cannot be booked and an ended event is closed', async () => {
    const c = await createWorkshop({ ...yoga, status: 'APPROVED' });
    await expect(createBooking({ workshopId: c.id, quantity: 1 }, 'a@example.com')).rejects.toMatchObject({ status: 409 });
    const ended = await createWorkshop({ ...inPerson, date: ymd(-2), status: 'APPROVED' });
    await expect(createBooking({ workshopId: ended.id, quantity: 1 }, 'a@example.com')).rejects.toMatchObject({ status: 409, message: 'This event has ended.' });
  });
});

describe('review fixes', () => {
  it('removing every price plan on edit makes the listing FREE at 0', async () => {
    const w = await createWorkshop(yoga);
    expect(w.type).toBe('PAID');
    const next = await updateWorkshop(w.id, { prices: [] });
    expect(next).toMatchObject({ type: 'FREE', pricePaise: 0, prices: [] });
  });
  it('an unknown topic id is a 400, not a 500', async () => {
    await expect(createWorkshop({ ...yoga, topicId: 99999 })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/topic/i) });
    const w = await createWorkshop(yoga);
    await expect(updateWorkshop(w.id, { topicId: 99999 })).rejects.toMatchObject({ status: 400 });
  });
  it('switching an in-person event to an online class clears its city and venue', async () => {
    const e = await createWorkshop(inPerson);
    const c = await updateWorkshop(e.id, { ...yoga, cityId: null, venue: null, seats: null });
    expect(c).toMatchObject({ mode: 'online', city: null, cityId: null, venue: null });
  });
  it('a city whose only listing ended is not active', async () => {
    const { listActiveCities } = await import('@/lib/cities');
    const kota = { ...inPerson, cityRef: cityRef('Kota'), status: 'APPROVED' };
    await createWorkshop({ ...kota, date: ymd(-3) });
    expect((await listActiveCities()).map(c => c.slug)).not.toContain('kota');
    await createWorkshop(kota);
    expect((await listActiveCities()).map(c => c.slug)).toContain('kota');
  });
});

describe('one request, several drafts, one current published listing', () => {
  const published = { ...yoga, status: 'APPROVED' };
  it('a draft listing of a request can be duplicated: another draft from the same request is allowed', async () => {
    const rid = await aRequest();
    const a = await createWorkshop({ ...yoga, sourceRequestId: rid });
    const b = await createWorkshop({ ...yoga, sourceRequestId: rid });
    expect([a.status, b.status]).toEqual(['DRAFT', 'DRAFT']);
    expect(b.sourceRequestId).toBe(rid);
    const { listWorkshopRequests } = await import('@/lib/workshop-requests');
    expect((await listWorkshopRequests()).find(r => r.id === rid)).toMatchObject({ status: 'listed', listedWorkshopId: b.id }); // the newest
  });
  it('two listings from the same request cannot both be published', async () => {
    const rid = await aRequest();
    await createWorkshop({ ...published, sourceRequestId: rid });
    await expect(createWorkshop({ ...published, sourceRequestId: rid })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/already came from this request/i) });
    expect((await createWorkshop({ ...yoga, sourceRequestId: rid })).status).toBe('DRAFT'); // a draft is still fine
  });
  it('publishing a draft is refused while another listing of the request is published; it works once that one is un-published', async () => {
    const rid = await aRequest();
    const first = await createWorkshop({ ...published, sourceRequestId: rid });
    const second = await createWorkshop({ ...yoga, sourceRequestId: rid });
    await expect(updateWorkshop(second.id, { status: 'APPROVED' })).rejects.toMatchObject({ status: 409 });
    await updateWorkshop(first.id, { status: 'DRAFT' });
    expect((await updateWorkshop(second.id, { status: 'APPROVED' })).status).toBe('APPROVED');
    await expect(updateWorkshop(first.id, { status: 'APPROVED' })).rejects.toMatchObject({ status: 409 });
  });
  it('re-saving the published one (changing its title) is not blocked by itself', async () => {
    const rid = await aRequest();
    const first = await createWorkshop({ ...published, sourceRequestId: rid });
    expect((await updateWorkshop(first.id, { title: 'Renamed' })).title).toBe('Renamed');
  });
  it('listings of different requests, or with no request, can all be published', async () => {
    await createWorkshop({ ...published, sourceRequestId: await aRequest() });
    await createWorkshop({ ...published, sourceRequestId: await aRequest() });
    await createWorkshop(published);
    await createWorkshop(published);
  });
  it('once the published listing has ended, the same request can be published again (a new run)', async () => {
    const rid = await aRequest();
    const old = await createWorkshop({ ...published, sourceRequestId: rid, date: ymd(-5), time: '10:00', schedule: undefined, kind: 'workshop', mode: 'in_person', cityRef: cityRef('Jodhpur'), venue: 'Studio', seats: 5, whatsapp: undefined });
    expect(old.status).toBe('APPROVED');
    const again = await createWorkshop({ ...published, sourceRequestId: rid });
    expect(again.status).toBe('APPROVED');
    // ...and now that one is current, a third cannot be published
    await expect(createWorkshop({ ...published, sourceRequestId: rid })).rejects.toMatchObject({ status: 409 });
  });
  it('a draft can be published while the other published listing of the request has ended', async () => {
    const rid = await aRequest();
    await createWorkshop({ ...published, sourceRequestId: rid, date: ymd(-5), time: '10:00', schedule: undefined, kind: 'workshop', mode: 'in_person', cityRef: cityRef('Jodhpur'), venue: 'Studio', seats: 5, whatsapp: undefined });
    const draft = await createWorkshop({ ...yoga, sourceRequestId: rid });
    expect((await updateWorkshop(draft.id, { status: 'APPROVED' })).status).toBe('APPROVED');
  });
  it('deleting one of two listings of a request keeps the request listed, pointing at the one that is left; deleting the last reopens it', async () => {
    const { deleteWorkshop } = await import('@/lib/admin');
    const { listWorkshopRequests } = await import('@/lib/workshop-requests');
    const rid = await aRequest();
    const a = await createWorkshop({ ...yoga, sourceRequestId: rid });
    const b = await createWorkshop({ ...yoga, sourceRequestId: rid });
    await deleteWorkshop(b.id);
    expect((await listWorkshopRequests()).find(r => r.id === rid)).toMatchObject({ status: 'listed', listedWorkshopId: a.id });
    await deleteWorkshop(a.id);
    expect((await listWorkshopRequests()).find(r => r.id === rid)).toMatchObject({ status: 'received' });
  });
});
