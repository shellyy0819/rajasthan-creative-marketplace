import { resolveMailConfig } from './settings';

export type Mail = { to: string; subject: string; text: string };
type Send = (mail: Mail) => Promise<void>;

let override: Send | null = null;
/** Tests replace the sender; pass null to restore Resend. */
export const setMailSenderForTests = (fn: Send | null) => { override = fn; };

/** True when mail can be sent (settings saved by an admin or the environment variables, or a test sender is installed). */
export const mailConfigured = async () => override !== null || (await resolveMailConfig()) !== null;

/** Sends one plain-text email through the Resend API. Throws when it is not configured or Resend refuses the message. */
export async function sendMail(mail: Mail): Promise<void> {
  if (override) return override(mail);
  const cfg = await resolveMailConfig();
  if (!cfg) throw new Error('Email is not configured.');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: cfg.from, to: [mail.to], subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { name?: string; message?: string } | null;
    throw new Error(`Resend refused the email (${res.status}${body?.name ? ` ${body.name}` : ''}): ${body?.message ?? 'no details'}`);
  }
}
