import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { DELETE, GET, PUT } from '@/app/api/admin/settings/email/route';
import { POST as TEST } from '@/app/api/admin/settings/email/test/route';
import { setMailSenderForTests, type Mail } from '@/lib/mailer';
import { resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });
const req = (body: unknown) => new Request('http://x/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(async () => { await resetTestDb(); authMock.mockReset(); authMock.mockResolvedValue(null); setMailSenderForTests(null); delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM; });

describe('/api/admin/settings/email', () => {
  it('is admin only', async () => {
    expect((await GET()).status).toBe(401);
    for (const role of ['customer', 'seller']) {
      as(role);
      expect((await GET()).status).toBe(403);
      expect((await PUT(req({ from: 'a@b.in', apiKey: 're_abcdefgh1234' }))).status).toBe(403);
      expect((await DELETE()).status).toBe(403);
      expect((await TEST(req({}))).status).toBe(403);
    }
  });
  it('saves, reads without the key, and removes', async () => {
    as('admin');
    const put = await PUT(req({ from: 'hello@craftofy.online', apiKey: 're_abcdefgh1234' }));
    expect(put.status).toBe(200);
    const got = await (await GET()).json();
    expect(got).toMatchObject({ provider: 'resend', from: 'hello@craftofy.online', apiKeySet: true, apiKeyHint: '1234', source: 'saved' });
    expect(JSON.stringify(got)).not.toContain('re_abcdefgh');
    expect((await PUT(req({ from: 'bad', apiKey: '' }))).status).toBe(400);
    expect((await (await DELETE()).json()).source).toBe('none');
  });
  it('saves SMTP settings through the API without ever returning the password', async () => {
    as('admin');
    const smtp = { provider: 'smtp', from: 'hello.craftofy@gmail.com', host: 'smtp.gmail.com', port: 465, secure: true, user: 'hello.craftofy@gmail.com', password: 'sup3r secret pass' };
    expect((await PUT(req(smtp))).status).toBe(200);
    const got = await (await GET()).json();
    expect(got).toMatchObject({ provider: 'smtp', source: 'saved', smtp: { host: 'smtp.gmail.com', passwordSet: true } });
    expect(JSON.stringify(got)).not.toContain('sup3r');
    expect((await PUT(req({ ...smtp, port: 0 }))).status).toBe(400);
  });
  it('sends a test email to the admin by default and reports a sender failure', async () => {
    as('admin');
    const sent: Mail[] = [];
    setMailSenderForTests(async m => { sent.push(m); });
    expect(await (await TEST(req({}))).json()).toEqual({ ok: true, to: 'admin@x.co' });
    expect(sent[0]).toMatchObject({ to: 'admin@x.co', subject: 'Craftofy test email' });
    expect((await TEST(req({ to: 'not-an-email' }))).status).toBe(400);
    setMailSenderForTests(async () => { throw new Error('domain not verified'); });
    const bad = await TEST(req({ to: 'me@x.co' }));
    expect(bad.status).toBe(502);
    expect((await bad.json()).error).toMatch(/domain not verified/);
  });
});
