import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendMail } from '@/lib/mailer';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); vi.stubEnv('RESEND_API_KEY', 're_testkey12345'); vi.stubEnv('MAIL_FROM', 'Craftofy <hello@craftofy.online>'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('sendMail attachments over Resend', () => {
  it('sends each attachment as base64 content with its filename', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await sendMail({ to: 'a@b.co', subject: 's', text: 't', attachments: [{ filename: 'v-1.jpg', content: Buffer.from([1, 2, 3]), contentType: 'image/jpeg' }] });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.attachments).toEqual([{ filename: 'v-1.jpg', content: Buffer.from([1, 2, 3]).toString('base64') }]);
  });
  it('sends no attachments key when there are none', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await sendMail({ to: 'a@b.co', subject: 's', text: 't' });
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).not.toHaveProperty('attachments');
  });
});
