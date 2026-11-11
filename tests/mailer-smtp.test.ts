import { describe, it, expect, beforeEach, vi } from 'vitest';

const sendMailMock = vi.hoisted(() => vi.fn());
const closeMock = vi.hoisted(() => vi.fn());
const createTransportMock = vi.hoisted(() => vi.fn());
vi.mock('nodemailer', () => ({ default: { createTransport: createTransportMock } }));

import { sendMail, setMailSenderForTests } from '@/lib/mailer';
import { saveEmailSettings } from '@/lib/settings';
import { resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
const SMTP = { provider: 'smtp', from: 'Craftofy <hello.craftofy@gmail.com>', host: 'smtp.gmail.com', port: 465, secure: true, user: 'hello.craftofy@gmail.com', password: 'abcd efgh ijkl mnop' };
const mail = { to: 'asha@x.in', subject: 'Your code', text: 'Code: 123456' };

beforeEach(async () => {
  await resetTestDb(); setMailSenderForTests(null); delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM;
  sendMailMock.mockReset(); closeMock.mockReset(); createTransportMock.mockReset();
  createTransportMock.mockReturnValue({ sendMail: sendMailMock, close: closeMock });
});

describe('sendMail over SMTP', () => {
  it('connects with the saved login, sends plain text from the saved sender, and closes the connection', async () => {
    await saveEmailSettings(SMTP, 'a@x.co');
    await sendMail(mail);
    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com', port: 465, secure: true, requireTLS: false, auth: { user: SMTP.user, pass: SMTP.password },
    }));
    expect(sendMailMock).toHaveBeenCalledWith({ from: SMTP.from, to: 'asha@x.in', subject: 'Your code', text: 'Code: 123456' });
    expect(closeMock).toHaveBeenCalled();
  });
  it('requires STARTTLS when SSL is off, so the password is never sent in the clear', async () => {
    await saveEmailSettings({ ...SMTP, port: 587, secure: false }, 'a@x.co');
    await sendMail(mail);
    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false, requireTLS: true }));
  });
  it('reports the server failure without echoing the password, and still closes the connection', async () => {
    await saveEmailSettings(SMTP, 'a@x.co');
    sendMailMock.mockRejectedValue(new Error(`535 Invalid login for ${SMTP.password}`));
    const err = (await sendMail(mail).then(() => null, (e: unknown) => e)) as Error;
    expect(err.message).toMatch(/SMTP server refused the email: 535 Invalid login/);
    expect(err.message).not.toContain(SMTP.password);
    expect(closeMock).toHaveBeenCalled();
  });
  it('does not use SMTP when Resend is the saved provider', async () => {
    await saveEmailSettings({ ...SMTP }, 'a@x.co');
    await saveEmailSettings({ provider: 'resend', from: 'hello@craftofy.online', apiKey: 're_abcdefgh12345678' }, 'a@x.co');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await sendMail(mail);
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.anything());
    expect(createTransportMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
  it('passes several recipients and a Reply-To to SMTP', async () => {
    await saveEmailSettings(SMTP, 'a@x.co');
    await sendMail({ ...mail, to: ['team@x.in', 'admin@x.in'], replyTo: 'host@x.in' });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ to: ['team@x.in', 'admin@x.in'], replyTo: 'host@x.in' }));
  });
  it('passes several recipients and a Reply-To to Resend, and adds neither when not given', async () => {
    await saveEmailSettings({ provider: 'resend', from: 'hello@craftofy.online', apiKey: 're_abcdefgh12345678' }, 'a@x.co');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await sendMail({ ...mail, to: ['team@x.in', 'admin@x.in'], replyTo: 'host@x.in' });
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({ to: ['team@x.in', 'admin@x.in'], reply_to: 'host@x.in' });
    await sendMail(mail);
    const plain = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(plain.to).toEqual(['asha@x.in']);
    expect(plain).not.toHaveProperty('reply_to');
    fetchMock.mockRestore();
  });
});
