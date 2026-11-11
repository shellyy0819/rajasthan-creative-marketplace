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
    expect(await getEmailSettings()).toEqual({ from: '', apiKeySet: false, source: 'none' });
    expect(await resolveMailConfig()).toBeNull();
    const v = await saveEmailSettings({ from: ' Craftofy <hello@craftofy.online> ', apiKey: KEY }, 'admin@x.co');
    expect(v).toEqual({ from: 'Craftofy <hello@craftofy.online>', apiKeySet: true, apiKeyHint: '5678', source: 'saved' });
    expect(JSON.stringify(v)).not.toContain(KEY);
    expect(await resolveMailConfig()).toEqual({ apiKey: KEY, from: 'Craftofy <hello@craftofy.online>' });
    const [row] = await (await getTestDb()).select().from(appSettings);
    expect(JSON.stringify(row.value)).not.toContain(KEY); // encrypted at rest
    expect(row.updatedBy).toBe('admin@x.co');
  });
  it('changes the sender and keeps the saved key when the key box is left empty', async () => {
    await saveEmailSettings({ from: 'a@craftofy.online', apiKey: KEY }, 'admin@x.co');
    await saveEmailSettings({ from: 'b@craftofy.online', apiKey: '' }, 'admin@x.co');
    expect(await resolveMailConfig()).toEqual({ apiKey: KEY, from: 'b@craftofy.online' });
    await saveEmailSettings({ from: 'b@craftofy.online', apiKey: 're_newkey12345678' }, 'admin@x.co');
    expect((await resolveMailConfig())?.apiKey).toBe('re_newkey12345678');
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
    expect(await resolveMailConfig()).toEqual({ apiKey: KEY, from: 'db@craftofy.online' });
    expect(await clearEmailSettings()).toMatchObject({ source: 'environment' });
    expect(await resolveMailConfig()).toEqual({ apiKey: 're_envkey1234567890', from: 'env@craftofy.online' });
  });
});
