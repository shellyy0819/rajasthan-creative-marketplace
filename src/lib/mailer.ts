import { resolveMailConfig, type SmtpConfig } from './settings';

/** `to` may be several addresses (all see each other: use it for the team only). `replyTo` makes Reply go to that person. */
export type Mail = { to: string | string[]; subject: string; text: string; replyTo?: string };
type Send = (mail: Mail) => Promise<void>;

let override: Send | null = null;
/** Tests replace the sender; pass null to restore Resend. */
export const setMailSenderForTests = (fn: Send | null) => { override = fn; };

/** True when mail can be sent (settings saved by an admin or the environment variables, or a test sender is installed). */
export const mailConfigured = async () => override !== null || (await resolveMailConfig()) !== null;

const TIMEOUT_MS = 10_000;

/** One plain-text email over SMTP. Port 465 uses SSL; otherwise STARTTLS is required, so the password never travels in the clear. */
async function sendSmtp(cfg: SmtpConfig, mail: Mail): Promise<void> {
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure, requireTLS: !cfg.secure, auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
  });
  try {
    await transport.sendMail({ from: cfg.from, to: mail.to, subject: mail.subject, text: mail.text, ...(mail.replyTo ? { replyTo: mail.replyTo } : {}) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'no details';
    throw new Error(`SMTP server refused the email: ${msg.split(cfg.pass).join('***')}`); // never echo the password back
  } finally {
    transport.close();
  }
}

/** Sends one plain-text email through the saved provider (Resend API or SMTP). Throws when it is not configured or the provider refuses the message. */
export async function sendMail(mail: Mail): Promise<void> {
  if (override) return override(mail);
  const cfg = await resolveMailConfig();
  if (!cfg) throw new Error('Email is not configured.');
  if (cfg.provider === 'smtp') return sendSmtp(cfg, mail);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: cfg.from, to: Array.isArray(mail.to) ? mail.to : [mail.to], subject: mail.subject, text: mail.text, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { name?: string; message?: string } | null;
    throw new Error(`Resend refused the email (${res.status}${body?.name ? ` ${body.name}` : ''}): ${body?.message ?? 'no details'}`);
  }
}
