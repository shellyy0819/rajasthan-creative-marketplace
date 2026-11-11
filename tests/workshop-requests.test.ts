import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ROLE_ID } from '@/db/people';
import { userRoles, users, workshopRequests } from '@/db/schema';
import { setMailSenderForTests, type Mail } from '@/lib/mailer';
import { envMailConfig } from '@/lib/settings';
import { submitErrorMessage } from '@/lib/workshop-requests-shared';
import { createWorkshopRequest, listWorkshopRequests, resendWorkshopRequestCode, verifyWorkshopRequestCode } from '@/lib/workshop-requests';
import { signCityRef } from '@/lib/city-ref';
import { getTestDb, resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
let sent: Mail[] = [];
const lastCode = () => /is (\d{6})\./.exec(sent.at(-1)?.text ?? '')?.[1] ?? '';
afterEach(() => { vi.unstubAllEnvs(); });
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
  it('keeps the request, as received but with an unconfirmed email, when the code email cannot be sent', async () => {
    setMailSenderForTests(async () => { throw new Error('refused'); });
    const r = await createWorkshopRequest(ok); // no error for the visitor
    expect(r).toMatchObject({ status: 'received', emailVerified: false });
    const [row] = await (await getTestDb()).select().from(workshopRequests);
    expect(row).toMatchObject({ status: 'received', codeHash: null, verifiedAt: null });
    expect(await listWorkshopRequests()).toMatchObject([{ id: r.id, emailVerified: false }]);
    await (await getTestDb()).update(workshopRequests).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).where(eq(workshopRequests.id, r.id));
    await createWorkshopRequest(ok); // the next submit purges old unconfirmed ones, but this one is received so it stays
    expect(await (await getTestDb()).select().from(workshopRequests)).toHaveLength(2);
  });
  it('also keeps the request when email is not set up at all in production', async () => {
    setMailSenderForTests(null);
    delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM;
    vi.stubEnv('NODE_ENV', 'production');
    const r = await createWorkshopRequest(ok);
    expect(r).toMatchObject({ status: 'received', emailVerified: false });
    expect(await listWorkshopRequests()).toHaveLength(1);
  });
  it('keeps the request, with no errors, when email is not set up at all (any environment) and the admin sees it', async () => {
    setMailSenderForTests(null);
    delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM;
    const r = await createWorkshopRequest(ok);
    expect(r).toMatchObject({ status: 'received', emailVerified: false, title: 'Nomad of Winter' });
    expect(await listWorkshopRequests()).toMatchObject([{ id: r.id, emailVerified: false, email: 'asha@flea.in', phone: '+919989898999' }]);
  });
  it('marks a confirmed request as emailVerified', async () => {
    const r = await createWorkshopRequest(ok);
    expect(r).toMatchObject({ status: 'unverified', emailVerified: false });
    expect(await verifyWorkshopRequestCode(r.id, lastCode())).toMatchObject({ status: 'received', emailVerified: true });
  });
  it('answers 503, not 502, when a requested resend cannot be emailed', async () => {
    const r = await createWorkshopRequest(ok);
    await (await getTestDb()).update(workshopRequests).set({ codeSentAt: new Date(Date.now() - 61_000) }).where(eq(workshopRequests.id, r.id));
    setMailSenderForTests(async () => { throw new Error('refused'); });
    await expect(resendWorkshopRequestCode(r.id)).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/could not send the code/) });
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
    expect(envMailConfig({ RESEND_API_KEY: ' re_x ', MAIL_FROM: ' Craftofy <hello@craftofy.online> ' })).toEqual({ provider: 'resend', apiKey: 're_x', from: 'Craftofy <hello@craftofy.online>' });
  });
});

describe('submitErrorMessage', () => {
  const MAIL = 'hello.craftofy@gmail.com';
  const FALLBACK = 'Something went wrong. Please mail us at hello.craftofy@gmail.com.';
  it('tells the visitor to mail us for server errors, network failures and unreadable answers', () => {
    expect(submitErrorMessage(500, 'boom', MAIL)).toBe(FALLBACK);
    expect(submitErrorMessage(503, 'We could not send the code right now.', MAIL)).toBe(FALLBACK);
    expect(submitErrorMessage(0, null, MAIL)).toBe(FALLBACK);
    expect(submitErrorMessage(400, undefined, MAIL)).toBe(FALLBACK);
    expect(submitErrorMessage(400, 42, MAIL)).toBe(FALLBACK);
  });
  it('keeps the specific message for things the visitor can fix', () => {
    expect(submitErrorMessage(400, 'phone must be a 10-digit Indian mobile number.', MAIL)).toBe('phone must be a 10-digit Indian mobile number.');
    expect(submitErrorMessage(429, 'Too many requests.', MAIL)).toBe('Too many requests.');
  });
});

describe('team notification', () => {
  const admin = async (email: string, active = true) => {
    const db = await getTestDb();
    const [u] = await db.insert(users).values({ email, name: 'Admin', active }).returning();
    await db.insert(userRoles).values({ userId: u.id, roleId: ROLE_ID.admin });
  };
  const confirm = async (extra: Record<string, unknown> = {}) => {
    const r = await createWorkshopRequest({ ...ok, ...extra });
    return verifyWorkshopRequestCode(r.id, lastCode());
  };
  const OLD_ENV = { ADMIN_EMAILS: process.env.ADMIN_EMAILS, CONTACT_EMAIL: process.env.CONTACT_EMAIL };
  afterEach(() => { for (const [k, v] of Object.entries(OLD_ENV)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

  it('emails the Craftofy address and every admin once, with all details, and replies go to the host', async () => {
    process.env.CONTACT_EMAIL = 'hello@craftofy.test'; process.env.ADMIN_EMAILS = 'Boss@x.co, hello@craftofy.test';
    await admin('db.admin@x.co'); await admin('boss@x.co'); await admin('gone@x.co', false);
    const done = await confirm({ seats: 20, priceType: 'PAID', priceRupees: 350, startTime: '10:00', endTime: '12:30', instagram: 'urbanflea', website: 'https://flea.in', notes: 'Bring tables', hostName: 'Urban Flea' });
    expect(done).toMatchObject({ status: 'received', emailVerified: true, notified: true });
    expect(sent).toHaveLength(2); // the code, then the team email
    const team = sent[1];
    expect(team.to).toEqual(expect.arrayContaining(['hello@craftofy.test', 'Boss@x.co', 'db.admin@x.co']));
    expect(team.to).toHaveLength(3); // no duplicates, and no inactive admin
    expect(team.replyTo).toBe('asha@flea.in');
    expect(team.subject).toBe('New workshop request: Nomad of Winter (Flea market, Ahmedabad, Gujarat)');
    for (const part of ['Nomad of Winter', 'Flea market', 'Stalls and music', '2026-12-18', '10:00-12:30', 'Riverfront', 'Ahmedabad, Gujarat', 'Seats: 20', 'Rs. 350 per person', 'Urban Flea', 'Asha', '+919989898999', 'asha@flea.in', 'urbanflea', 'https://flea.in', 'Bring tables', 'Dashboard > Workshop requests']) {
      expect(team.text).toContain(part);
    }
  });
  it('sends nothing to the team until the host confirms the email code', async () => {
    await createWorkshopRequest(ok);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/verification code/i);
  });
  it('does not email the team again when the same request is confirmed twice', async () => {
    const r = await createWorkshopRequest(ok);
    const code = lastCode();
    expect((await verifyWorkshopRequestCode(r.id, code)).notified).toBe(true);
    expect((await verifyWorkshopRequestCode(r.id, code)).notified).toBe(false);
    expect(sent).toHaveLength(2);
  });
  it('still confirms the request, without an error, when the team email cannot be sent', async () => {
    const r = await createWorkshopRequest(ok);
    const code = lastCode();
    setMailSenderForTests(async () => { throw new Error('refused'); });
    expect(await verifyWorkshopRequestCode(r.id, code)).toMatchObject({ status: 'received', emailVerified: true, notified: false });
    expect(await listWorkshopRequests()).toHaveLength(1);
  });
  it('keeps one-line subjects even when the title has line breaks', async () => {
    await confirm({ title: 'Line one\nBcc: x@y.in' });
    expect(sent[1].subject).not.toMatch(/[\r\n]/);
  });
});
