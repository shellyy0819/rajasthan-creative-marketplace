import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createWorkshop, updateWorkshop } from '@/lib/admin';
import { getWorkshopBySlug, listAdminWorkshops, listWorkshops } from '@/lib/catalog';
import { createBooking } from '@/lib/orders';
import { workshopSlug } from '@/lib/catalog-shared';
import { isCurrent } from '@/lib/workshop-listing';
import { workshopPrices, users } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

const ymd = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
const inPerson = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.' };
const yoga = {
  title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: ymd(1), host: 'Asha Rao', description: 'Gentle hatha yoga.',
  schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 }, languages: ['Hindi', 'English'], level: 'beginner', freeTrial: true,
  whatsapp: '9989898999', instagram: '@asha.yoga', contactName: 'Asha Rao', contactPhone: '9989898999', contactEmail: 'asha@example.com',
  prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }, { label: 'Per session', amountPaise: 50000, sessions: 1 }],
};

beforeEach(async () => { await resetTestDb(); });

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
    const w = await createWorkshop({ ...yoga, sourceRequestId: '11111111-1111-4111-8111-111111111111' }, u.email);
    expect(w).toMatchObject({ createdBy: u.id, sourceRequestId: '11111111-1111-4111-8111-111111111111' });
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
    const c = await createWorkshop({ ...yoga, status: 'APPROVED', sourceRequestId: '11111111-1111-4111-8111-111111111111' });
    const listed = (await listWorkshops()).find(w => w.id === c.id)!;
    const paged = (await getWorkshopBySlug(workshopSlug(c)))!;
    for (const w of [listed, paged]) {
      const j = JSON.stringify(w);
      for (const k of ['contactName', 'contactPhone', 'contactEmail', 'createdBy', 'sourceRequestId', 'hostId']) expect(j).not.toContain(k);
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
