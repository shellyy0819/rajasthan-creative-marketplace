import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appSettings } from '@/db/schema';
import { open, seal } from '@/lib/secret-box';
import { clearEmailSettings, getEmailSettings, resolveMailConfig, saveEmailSettings } from '@/lib/settings';
import { getTestDb, resetTestDb } from './helpers/testdb';

process.env.NEXTAUTH_SECRET = 'test-secret';
const KEY = 're_abcdefgh12345678';
beforeEach(async () => { await resetTestDb(); delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM; });
afterEach(() => { delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM; });

describe('secret box', () => {
  it('round-trips, never repeats, and refuses tampering or another secret', () => {
    const a = seal(KEY), b = seal(KEY);
    expect(a).not.toBe(b);
    expect(a).not.toContain(KEY);
    expect(open(a)).toBe(KEY);
    expect(open(a.slice(0, -2) + 'xx')).toBeNull();
    expect(open('garbage')).toBeNull();
    process.env.NEXTAUTH_SECRET = 'other';
    expect(open(a)).toBeNull();
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });
});

describe('email settings', () => {
  it('starts empty, saves the sender and key, and only ever shows the last 4 characters', async () => {
    expect(await getEmailSettings()).toEqual({ provider: 'resend', from: '', apiKeySet: false, smtp: { from: '', host: '', port: 465, secure: true, user: '', passwordSet: false }, source: 'none' });
    expect(await resolveMailConfig()).toBeNull();
    const v = await saveEmailSettings({ from: ' Craftofy <hello@craftofy.online> ', apiKey: KEY }, 'admin@x.co');
    expect(v).toMatchObject({ provider: 'resend', from: 'Craftofy <hello@craftofy.online>', apiKeySet: true, apiKeyHint: '5678', source: 'saved' });
    expect(JSON.stringify(v)).not.toContain(KEY);
    expect(await resolveMailConfig()).toEqual({ provider: 'resend', apiKey: KEY, from: 'Craftofy <hello@craftofy.online>' });
    const [row] = await (await getTestDb()).select().from(appSettings);
    expect(JSON.stringify(row.value)).not.toContain(KEY); // encrypted at rest
    expect(row.updatedBy).toBe('admin@x.co');
  });
  it('changes the sender and keeps the saved key when the key box is left empty', async () => {
    await saveEmailSettings({ from: 'a@craftofy.online', apiKey: KEY }, 'admin@x.co');
    await saveEmailSettings({ from: 'b@craftofy.online', apiKey: '' }, 'admin@x.co');
    expect(await resolveMailConfig()).toEqual({ provider: 'resend', apiKey: KEY, from: 'b@craftofy.online' });
    await saveEmailSettings({ from: 'b@craftofy.online', apiKey: 're_newkey12345678' }, 'admin@x.co');
    expect(await resolveMailConfig()).toMatchObject({ provider: 'resend', apiKey: 're_newkey12345678' });
  });
  it('validates the sender and the key', async () => {
    const bads: [Record<string, unknown>, RegExp][] = [
      [{ from: '', apiKey: KEY }, /from/], [{ from: 'nope', apiKey: KEY }, /from/], [{ from: 'a@b', apiKey: KEY }, /from/], [{ from: 'Evil <x@y.in>\nBcc: z@y.in', apiKey: KEY }, /from/],
      [{ from: 'a@b.in', apiKey: 'sk_123456789' }, /apiKey/], [{ from: 'a@b.in' }, /apiKey is required/], [{ from: 'a@b.in', apiKey: 5 }, /apiKey/],
    ];
    for (const [input, msg] of bads) await expect(saveEmailSettings(input, 'a@x.co')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(msg) });
  });
  it('prefers saved settings over the environment, falls back to it after removal', async () => {
    process.env.RESEND_API_KEY = 're_envkey1234567890'; process.env.MAIL_FROM = 'env@craftofy.online';
    expect(await getEmailSettings()).toMatchObject({ source: 'environment', from: 'env@craftofy.online', apiKeyHint: '7890' });
    await saveEmailSettings({ from: 'db@craftofy.online', apiKey: KEY }, 'a@x.co');
    expect(await resolveMailConfig()).toEqual({ provider: 'resend', apiKey: KEY, from: 'db@craftofy.online' });
    expect(await clearEmailSettings()).toMatchObject({ source: 'environment' });
    expect(await resolveMailConfig()).toEqual({ provider: 'resend', apiKey: 're_envkey1234567890', from: 'env@craftofy.online' });
  });
});

const SMTP = { provider: 'smtp', from: 'Craftofy <hello.craftofy@gmail.com>', host: 'SMTP.Gmail.com', port: 465, secure: true, user: 'hello.craftofy@gmail.com', password: 'abcd efgh ijkl mnop' };

describe('smtp provider', () => {
  it('saves the server and login, hides the password, and resolves a decrypted config', async () => {
    const v = await saveEmailSettings(SMTP, 'admin@x.co');
    expect(v).toMatchObject({ provider: 'smtp', source: 'saved', smtp: { from: SMTP.from, host: 'smtp.gmail.com', port: 465, secure: true, user: SMTP.user, passwordSet: true } });
    expect(JSON.stringify(v)).not.toContain(SMTP.password);
    expect(await resolveMailConfig()).toEqual({ provider: 'smtp', from: SMTP.from, host: 'smtp.gmail.com', port: 465, secure: true, user: SMTP.user, pass: SMTP.password });
    const [row] = await (await getTestDb()).select().from(appSettings);
    expect(JSON.stringify(row.value)).not.toContain(SMTP.password); // encrypted at rest
  });
  it('keeps the saved password when the box is left empty, and replaces it when one is typed', async () => {
    await saveEmailSettings(SMTP, 'a@x.co');
    await saveEmailSettings({ ...SMTP, password: '', port: 587, secure: false }, 'a@x.co');
    expect(await resolveMailConfig()).toMatchObject({ provider: 'smtp', port: 587, secure: false, pass: SMTP.password });
    await saveEmailSettings({ ...SMTP, password: 'new-secret' }, 'a@x.co');
    expect(await resolveMailConfig()).toMatchObject({ pass: 'new-secret' });
  });
  it('keeps the other provider saved when switching, so nothing has to be typed again', async () => {
    await saveEmailSettings({ from: 'hello@craftofy.online', apiKey: KEY }, 'a@x.co');
    await saveEmailSettings(SMTP, 'a@x.co');
    expect(await getEmailSettings()).toMatchObject({ provider: 'smtp', apiKeySet: true, apiKeyHint: '5678', from: 'hello@craftofy.online' });
    expect(await resolveMailConfig()).toMatchObject({ provider: 'smtp' });
    await saveEmailSettings({ provider: 'resend', from: 'hello@craftofy.online', apiKey: '' }, 'a@x.co');
    expect(await resolveMailConfig()).toEqual({ provider: 'resend', apiKey: KEY, from: 'hello@craftofy.online' });
    expect(await getEmailSettings()).toMatchObject({ provider: 'resend', smtp: { host: 'smtp.gmail.com', passwordSet: true } });
  });
  it('reads a row saved before SMTP existed (no provider) as Resend', async () => {
    await (await getTestDb()).insert(appSettings).values({ key: 'email', value: { from: 'old@craftofy.online', apiKey: seal(KEY) }, updatedBy: 'a@x.co' });
    expect(await resolveMailConfig()).toEqual({ provider: 'resend', apiKey: KEY, from: 'old@craftofy.online' });
    expect(await getEmailSettings()).toMatchObject({ provider: 'resend', source: 'saved', apiKeySet: true });
  });
  it('falls back to the environment when the saved password cannot be decrypted', async () => {
    process.env.RESEND_API_KEY = 're_envkey1234567890'; process.env.MAIL_FROM = 'env@craftofy.online';
    await saveEmailSettings(SMTP, 'a@x.co');
    process.env.NEXTAUTH_SECRET = 'rotated';
    expect(await resolveMailConfig()).toEqual({ provider: 'resend', apiKey: 're_envkey1234567890', from: 'env@craftofy.online' });
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });
  it('validates provider, sender, server, port, security, username and password', async () => {
    const bads: [Record<string, unknown>, RegExp][] = [
      [{ provider: 'sendgrid' }, /provider/], [{ ...SMTP, from: 'nope' }, /from/], [{ ...SMTP, host: '' }, /host/], [{ ...SMTP, host: 'a b.com' }, /host/], [{ ...SMTP, host: 'http://x.com' }, /host/],
      [{ ...SMTP, port: 0 }, /port/], [{ ...SMTP, port: 70000 }, /port/], [{ ...SMTP, port: 'abc' }, /port/], [{ ...SMTP, secure: 'yes' }, /secure/],
      [{ ...SMTP, user: '' }, /user/], [{ ...SMTP, user: 'a\nb' }, /user/], [{ ...SMTP, password: '' }, /password is required/], [{ ...SMTP, password: 5 }, /password/], [{ ...SMTP, password: 'x'.repeat(201) }, /password/],
    ];
    for (const [input, msg] of bads) await expect(saveEmailSettings(input, 'a@x.co')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(msg) });
  });
  it('accepts a numeric string for the port', async () => {
    await saveEmailSettings({ ...SMTP, port: '587', secure: false }, 'a@x.co');
    expect(await resolveMailConfig()).toMatchObject({ port: 587, secure: false });
  });
});
