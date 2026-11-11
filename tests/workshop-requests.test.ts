import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { workshopRequests } from '@/db/schema';
import { setMailSenderForTests, type Mail } from '@/lib/mailer';
import { envMailConfig } from '@/lib/settings';
import { createWorkshopRequest, listWorkshopRequests, resendWorkshopRequestCode, verifyWorkshopRequestCode } from '@/lib/workshop-requests';
import { signCityRef } from '@/lib/city-ref';
import { getTestDb, resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
let sent: Mail[] = [];
const lastCode = () => /is (\d{6})\./.exec(sent.at(-1)?.text ?? '')?.[1] ?? '';
beforeEach(async () => { await resetTestDb(); sent = []; setMailSenderForTests(async m => { sent.push(m); }); });
const ok = {
  hostName: 'Urban Flea', contactName: 'Asha', phone: '+91 99898 98999', email: 'asha@flea.in', cityRef: signCityRef({ osmType: 'R', osmId: 1, name: 'Ahmedabad', state: 'Gujarat', lat: 23, lng: 72.5 }), venue: 'Riverfront',
  title: 'Nomad of Winter', kind: 'market', description: 'Stalls and music', startDate: '2026-12-18', priceType: 'FREE',
};

describe('createWorkshopRequest', () => {
  it('uses the start date as the end date when none is given, and omits optional fields', async () => {
    const r = await createWorkshopRequest(ok);
    expect(r).toMatchObject({ city: 'Ahmedabad, Gujarat', images: [], startDate: '2026-12-18', endDate: '2026-12-18', phone: '+919989898999', kind: 'market', priceType: 'FREE' });
    expect(r).not.toHaveProperty('startTime'); expect(r).not.toHaveProperty('seats'); expect(r).not.toHaveProperty('pricePaise');
    expect(r.status).toBe('unverified');
    expect(await listWorkshopRequests()).toHaveLength(0); // hidden until the email is confirmed
  });
  it('keeps an end date and optional times, and converts a paid price to paise', async () => {
    const r = await createWorkshopRequest({ ...ok, endDate: '2026-12-20', startTime: '10:00', endTime: '20:00', priceType: 'PAID', priceRupees: 499, seats: 40 });
    expect(r).toMatchObject({ endDate: '2026-12-20', startTime: '10:00', endTime: '20:00', pricePaise: 49900, seats: 40 });
  });
  it('rejects bad dates, times, kinds and prices', async () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ startDate: '' }, /startDate/], [{ startDate: '2026-02-30' }, /startDate/], [{ endDate: '2026-12-17' }, /endDate/],
      [{ startTime: '25:00' }, /startTime/], [{ endTime: 'noon' }, /endTime/], [{ startTime: '12:00', endTime: '11:00' }, /endTime/],
      [{ cityRef: 'Ahmedabad' }, /city/], [{ cityRef: undefined }, /city/], [{ images: ['https://evil.example/a.jpg'] }, /photos/], [{ images: [1, 2, 3, 4] }, /images/], [{ kind: 'party' }, /kind/], [{ priceType: 'PAID' }, /priceRupees/], [{ seats: 0 }, /seats/], [{ phone: '123' }, /phone/], [{ email: 'x' }, /email/],
    ];
    for (const [bad, msg] of cases) await expect(createWorkshopRequest({ ...ok, ...bad })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(msg) });
    expect(await listWorkshopRequests()).toHaveLength(0);
  });
  it('allows an earlier end time on a later end date', async () => {
    expect((await createWorkshopRequest({ ...ok, endDate: '2026-12-19', startTime: '22:00', endTime: '02:00' })).endTime).toBe('02:00');
  });
});

describe('email verification', () => {
  it('emails a 6-digit code and shows the request to admins only after it is confirmed', async () => {
    const r = await createWorkshopRequest(ok);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'asha@flea.in', subject: expect.stringMatching(/verification code/i) });
    expect(lastCode()).toMatch(/^\d{6}$/);
    expect((await verifyWorkshopRequestCode(r.id, lastCode())).status).toBe('received');
    expect(await listWorkshopRequests()).toHaveLength(1);
    const [row] = await (await getTestDb()).select().from(workshopRequests);
    expect(row).toMatchObject({ status: 'received', codeHash: null });
    expect(row.verifiedAt).toBeInstanceOf(Date);
  });
  it('stores only a hash of the code', async () => {
    await createWorkshopRequest(ok);
    const [row] = await (await getTestDb()).select().from(workshopRequests);
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.codeHash).not.toContain(lastCode());
  });
  it('rejects a wrong code, and burns the code after 5 wrong tries', async () => {
    const r = await createWorkshopRequest(ok);
    const wrong = lastCode() === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(verifyWorkshopRequestCode(r.id, wrong)).rejects.toMatchObject({ status: 400 });
    await expect(verifyWorkshopRequestCode(r.id, lastCode())).rejects.toMatchObject({ status: 429 }); // even the right code is refused now
    expect(await listWorkshopRequests()).toHaveLength(0);
  });
  it('rejects malformed codes, unknown ids and expired codes', async () => {
    const r = await createWorkshopRequest(ok);
    await expect(verifyWorkshopRequestCode(r.id, '12ab')).rejects.toMatchObject({ status: 400 });
    await expect(verifyWorkshopRequestCode(r.id, 123456)).rejects.toMatchObject({ status: 400 });
    await expect(verifyWorkshopRequestCode('nope', '123456')).rejects.toMatchObject({ status: 404 });
    await expect(verifyWorkshopRequestCode('00000000-0000-4000-8000-000000000000', '123456')).rejects.toMatchObject({ status: 404 });
    await (await getTestDb()).update(workshopRequests).set({ codeExpiresAt: new Date(Date.now() - 1000) }).where(eq(workshopRequests.id, r.id));
    await expect(verifyWorkshopRequestCode(r.id, lastCode())).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/expired/) });
  });
  it('resends a new code at most once a minute and 5 times in all; the old code stops working', async () => {
    const r = await createWorkshopRequest(ok);
    const first = lastCode();
    await expect(resendWorkshopRequestCode(r.id)).rejects.toMatchObject({ status: 429 }); // too soon
    const db = await getTestDb();
    const back = () => db.update(workshopRequests).set({ codeSentAt: new Date(Date.now() - 61_000) }).where(eq(workshopRequests.id, r.id));
    await back(); await resendWorkshopRequestCode(r.id);
    expect(sent).toHaveLength(2);
    if (lastCode() !== first) await expect(verifyWorkshopRequestCode(r.id, first)).rejects.toMatchObject({ status: 400 });
    for (let i = 0; i < 3; i++) { await back(); await resendWorkshopRequestCode(r.id); }
    await back();
    await expect(resendWorkshopRequestCode(r.id)).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/Too many codes/) });
    expect((await verifyWorkshopRequestCode(r.id, lastCode())).status).toBe('received');
    await expect(resendWorkshopRequestCode(r.id)).rejects.toMatchObject({ status: 409 });
  });
  it('keeps no request when the email cannot be sent', async () => {
    setMailSenderForTests(async () => { throw new Error('refused'); });
    await expect(createWorkshopRequest(ok)).rejects.toMatchObject({ status: 502 });
    expect(await (await getTestDb()).select().from(workshopRequests)).toHaveLength(0);
  });
  it('drops unverified requests older than a day when the next one arrives', async () => {
    const old = await createWorkshopRequest(ok);
    await (await getTestDb()).update(workshopRequests).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).where(eq(workshopRequests.id, old.id));
    await createWorkshopRequest(ok);
    expect(await (await getTestDb()).select().from(workshopRequests)).toHaveLength(1);
  });
});

describe('envMailConfig', () => {
  it('is null until both the Resend API key and a from address are set', () => {
    expect(envMailConfig({})).toBeNull();
    expect(envMailConfig({ RESEND_API_KEY: 're_x' })).toBeNull();
    expect(envMailConfig({ MAIL_FROM: 'Craftofy <hello@craftofy.online>' })).toBeNull();
    expect(envMailConfig({ RESEND_API_KEY: ' re_x ', MAIL_FROM: ' Craftofy <hello@craftofy.online> ' })).toEqual({ apiKey: 're_x', from: 'Craftofy <hello@craftofy.online>' });
  });
});
