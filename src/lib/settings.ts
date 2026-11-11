import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { ApiError } from './errors';
import { open, seal } from './secret-box';
import { OTP_FROM } from './site';
import { EMAIL_RE, bad, obj, optionalText } from './validate';

export type MailProvider = 'resend' | 'smtp';
export type ResendConfig = { provider: 'resend'; apiKey: string; from: string };
export type SmtpConfig = { provider: 'smtp'; host: string; port: number; secure: boolean; user: string; pass: string; from: string };
export type MailConfig = ResendConfig | SmtpConfig;

/**
 * The saved row. Both providers can be kept at once so switching never loses the other one's details; `provider` says which is used.
 * Rows saved before SMTP existed have no `provider` and only the Resend fields, and are read as Resend. Secrets are sealed.
 */
type StoredSmtp = { from: string; host: string; port: number; secure: boolean; user: string; pass: string /* sealed */ };
type StoredEmail = { provider?: MailProvider; from?: string; apiKey?: string /* sealed */; otpFrom?: string; smtp?: StoredSmtp };

/** What the admin screen may see: never a secret itself. For Resend only whether a key is saved and its last 4 characters; for SMTP only whether a password is saved. */
export type EmailSettingsView = {
  provider: MailProvider;
  from: string; apiKeySet: boolean; apiKeyHint?: string; // the Resend details
  otpFrom: string; // sender of verification codes over Resend; empty means the default (OTP_FROM)
  smtp: { from: string; host: string; port: number; secure: boolean; user: string; passwordSet: boolean };
  source: 'saved' | 'environment' | 'none';
};

const clean = (v: string | undefined) => (v ?? '').trim();
const EMPTY_SMTP: EmailSettingsView['smtp'] = { from: '', host: '', port: 465, secure: true, user: '', passwordSet: false };

export function envMailConfig(env: Record<string, string | undefined> = process.env): ResendConfig | null {
  const apiKey = clean(env.RESEND_API_KEY), from = clean(env.MAIL_FROM);
  return apiKey && from ? { provider: 'resend', apiKey, from } : null;
}

async function readStored(): Promise<StoredEmail | null> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'email'));
  const v = row?.value as StoredEmail | undefined;
  if (!v || typeof v !== 'object') return null;
  const smtp = v.smtp && typeof v.smtp.host === 'string' && typeof v.smtp.pass === 'string' ? v.smtp : undefined;
  const resend = typeof v.from === 'string' && typeof v.apiKey === 'string';
  if (!smtp && !resend) return null;
  const otpFrom = typeof v.otpFrom === 'string' && v.otpFrom ? v.otpFrom : undefined;
  return { provider: v.provider === 'smtp' ? 'smtp' : 'resend', ...(resend ? { from: v.from, apiKey: v.apiKey } : {}), ...(otpFrom ? { otpFrom } : {}), ...(smtp ? { smtp } : {}) };
}

function storedResend(stored: StoredEmail | null): ResendConfig | null {
  const apiKey = stored?.apiKey ? open(stored.apiKey) : null;
  return stored?.from && apiKey ? { provider: 'resend', apiKey, from: stored.from } : null;
}
function storedSmtp(stored: StoredEmail | null): SmtpConfig | null {
  const s = stored?.smtp, pass = s ? open(s.pass) : null;
  return s && pass ? { provider: 'smtp', host: s.host, port: s.port, secure: s.secure, user: s.user, pass, from: s.from } : null;
}

/** The mail settings in use: the provider an admin saved on the Settings page, otherwise the RESEND_API_KEY / MAIL_FROM environment variables. */
export async function resolveMailConfig(): Promise<MailConfig | null> {
  const stored = await readStored().catch(() => null); // a database hiccup must not stop the env fallback
  const saved = stored?.provider === 'smtp' ? storedSmtp(stored) : storedResend(stored);
  return saved ?? envMailConfig();
}

export async function getEmailSettings(): Promise<EmailSettingsView> {
  const stored = await readStored();
  const resend = storedResend(stored), smtp = storedSmtp(stored);
  const view = {
    from: stored?.from ?? '', otpFrom: stored?.otpFrom ?? '',
    apiKeySet: !!resend, ...(resend ? { apiKeyHint: resend.apiKey.slice(-4) } : {}),
    smtp: stored?.smtp ? { from: stored.smtp.from, host: stored.smtp.host, port: stored.smtp.port, secure: stored.smtp.secure, user: stored.smtp.user, passwordSet: !!smtp } : EMPTY_SMTP,
  };
  const provider = stored?.provider ?? 'resend';
  if (provider === 'smtp' ? smtp : resend) return { provider, ...view, source: 'saved' };
  const env = envMailConfig();
  if (env) return { provider: 'resend', ...view, from: env.from, apiKeySet: true, apiKeyHint: env.apiKey.slice(-4), source: 'environment' };
  return { provider, ...view, source: 'none' };
}

/** "hello@craftofy.online" or "Craftofy <hello@craftofy.online>". */
const FROM_RE = /^(?:[^<>@\r\n]{1,80}<[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+>|[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+)$/;
const KEY_RE = /^re_[A-Za-z0-9_-]{8,200}$/;
const HOST_RE = /^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/;

const cleanFrom = (v: unknown) => {
  const from = typeof v === 'string' ? v.trim() : '';
  if (!from || from.length > 200 || !FROM_RE.test(from)) throw bad('from must be an email address like hello@yourdomain.com or Craftofy <hello@yourdomain.com>.');
  return from;
};

/** The optional sender for verification codes. Blank clears it, so the default (OTP_FROM) applies. */
function otpFromField(raw: Record<string, unknown>): { otpFrom?: string } {
  const v = typeof raw.otpFrom === 'string' ? raw.otpFrom.trim() : '';
  if (raw.otpFrom !== undefined && raw.otpFrom !== null && typeof raw.otpFrom !== 'string') throw bad('otpFrom must be text.');
  if (!v) return {};
  try { return { otpFrom: cleanFrom(v) }; } catch { throw bad('otpFrom must be an email address like no-reply@yourdomain.com or Craftofy <no-reply@yourdomain.com>.'); }
}

function resendFields(raw: Record<string, unknown>, stored: StoredEmail | null): { from: string; apiKey: string } {
  const from = cleanFrom(raw.from);
  const typed = optionalText(raw.apiKey, 'apiKey', 300);
  if (typed) {
    if (!KEY_RE.test(typed)) throw bad('apiKey must be a Resend API key that starts with re_.');
    return { from, apiKey: seal(typed) };
  }
  if (stored?.apiKey && open(stored.apiKey)) return { from, apiKey: stored.apiKey };
  throw bad('apiKey is required the first time.');
}

function smtpFields(raw: Record<string, unknown>, stored: StoredEmail | null): StoredSmtp {
  const from = cleanFrom(raw.from);
  const host = typeof raw.host === 'string' ? raw.host.trim().toLowerCase() : '';
  if (!HOST_RE.test(host)) throw bad('host must be a server name like smtp.gmail.com.');
  const port = typeof raw.port === 'number' ? raw.port : typeof raw.port === 'string' && /^\d{1,5}$/.test(raw.port.trim()) ? Number(raw.port) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw bad('port must be a number from 1 to 65535.');
  if (typeof raw.secure !== 'boolean') throw bad('secure must be true (SSL, usually port 465) or false (STARTTLS, usually port 587).');
  const user = typeof raw.user === 'string' ? raw.user.trim() : '';
  if (!user || user.length > 254 || /[\r\n]/.test(user)) throw bad('user is required (usually the full email address).');
  const typed = typeof raw.password === 'string' && raw.password !== '' ? raw.password : undefined;
  if (raw.password !== undefined && typeof raw.password !== 'string') throw bad('password must be text.');
  if (typed !== undefined && (typed.length > 200 || /[\r\n]/.test(typed))) throw bad('password is too long or has line breaks.');
  // A saved password is only ever reused for the same login on the same server. Pointing the settings at another server, port or user
  // must not make the app present the old password there, so it has to be typed again.
  const sameTarget = !!stored?.smtp && stored.smtp.host === host && stored.smtp.port === port && stored.smtp.user === user;
  let pass: string;
  if (typed) pass = seal(typed);
  else if (sameTarget && open(stored!.smtp!.pass)) pass = stored!.smtp!.pass;
  else if (stored?.smtp) throw bad('password is required again when the server, port or username changes.');
  else throw bad('password is required the first time.');
  return { from, host, port, secure: raw.secure, user, pass };
}

/**
 * Saves the chosen provider's details and makes it the one in use. The other provider's saved details are kept.
 * Blank secrets (Resend key, SMTP password) keep the ones already saved.
 */
export async function saveEmailSettings(input: unknown, actorEmail: string): Promise<EmailSettingsView> {
  const raw = obj(input);
  const provider = raw.provider === undefined ? 'resend' : raw.provider; // callers from before SMTP existed send no provider
  if (provider !== 'resend' && provider !== 'smtp') throw bad('provider must be resend or smtp.');
  const stored = await readStored();
  const value: StoredEmail = provider === 'smtp'
    ? { ...(stored?.from && stored.apiKey ? { from: stored.from, apiKey: stored.apiKey } : {}), ...(stored?.otpFrom ? { otpFrom: stored.otpFrom } : {}), provider, smtp: smtpFields(raw, stored) }
    : { ...(stored?.smtp ? { smtp: stored.smtp } : {}), provider, ...resendFields(raw, stored), ...otpFromField(raw) };
  await getDb().insert(appSettings).values({ key: 'email', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return getEmailSettings();
}

/** Forgets everything saved here (both providers); mail then falls back to the environment variables, if any. */
export async function clearEmailSettings(): Promise<EmailSettingsView> {
  await getDb().delete(appSettings).where(eq(appSettings.key, 'email'));
  return getEmailSettings();
}

/** Who verification codes are sent from (over Resend; SMTP always sends as its own account): the saved sender, else no-reply@craftofy.online. */
export async function otpSender(): Promise<string> {
  const stored = await readStored().catch(() => null);
  return stored?.otpFrom ?? OTP_FROM;
}

export function assertEmail(v: unknown): string {
  const e = typeof v === 'string' ? v.trim() : '';
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) throw new ApiError(400, 'Enter a valid email address.');
  return e;
}
