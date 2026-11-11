import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { ApiError } from './errors';
import { open, seal } from './secret-box';
import { EMAIL_RE, bad, obj, optionalText } from './validate';

export type MailConfig = { apiKey: string; from: string };
type StoredEmail = { from: string; apiKey: string /* sealed */ };

/** What the admin screen may see: never the key itself, only whether one is saved and its last 4 characters. */
export type EmailSettingsView = {
  from: string; apiKeySet: boolean; apiKeyHint?: string; source: 'saved' | 'environment' | 'none';
};

const clean = (v: string | undefined) => (v ?? '').trim();

export function envMailConfig(env: Record<string, string | undefined> = process.env): MailConfig | null {
  const apiKey = clean(env.RESEND_API_KEY), from = clean(env.MAIL_FROM);
  return apiKey && from ? { apiKey, from } : null;
}

async function readStored(): Promise<StoredEmail | null> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'email'));
  const v = row?.value as Partial<StoredEmail> | undefined;
  return v && typeof v.from === 'string' && typeof v.apiKey === 'string' ? { from: v.from, apiKey: v.apiKey } : null;
}

/** The mail settings in use: what an admin saved on the Settings page, otherwise the RESEND_API_KEY / MAIL_FROM environment variables. */
export async function resolveMailConfig(): Promise<MailConfig | null> {
  const stored = await readStored().catch(() => null); // a database hiccup must not stop the env fallback
  const apiKey = stored ? open(stored.apiKey) : null;
  if (stored && apiKey) return { apiKey, from: stored.from };
  return envMailConfig();
}

export async function getEmailSettings(): Promise<EmailSettingsView> {
  const stored = await readStored();
  const apiKey = stored ? open(stored.apiKey) : null;
  if (stored && apiKey) return { from: stored.from, apiKeySet: true, apiKeyHint: apiKey.slice(-4), source: 'saved' };
  const env = envMailConfig();
  if (env) return { from: env.from, apiKeySet: true, apiKeyHint: env.apiKey.slice(-4), source: 'environment' };
  return { from: stored?.from ?? '', apiKeySet: false, source: 'none' };
}

/** "hello@craftofy.online" or "Craftofy <hello@craftofy.online>". */
const FROM_RE = /^(?:[^<>@\r\n]{1,80}<[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+>|[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+)$/;
const KEY_RE = /^re_[A-Za-z0-9_-]{8,200}$/;

/** Saves the sender address and, when a new one is typed, the Resend API key (blank keeps the saved key). */
export async function saveEmailSettings(input: unknown, actorEmail: string): Promise<EmailSettingsView> {
  const raw = obj(input);
  const from = typeof raw.from === 'string' ? raw.from.trim() : '';
  if (!from || from.length > 200 || !FROM_RE.test(from)) throw bad('from must be an email address like hello@yourdomain.com or Craftofy <hello@yourdomain.com>.');
  const typed = optionalText(raw.apiKey, 'apiKey', 300);
  const stored = await readStored();
  let sealed: string;
  if (typed) {
    if (!KEY_RE.test(typed)) throw bad('apiKey must be a Resend API key that starts with re_.');
    sealed = seal(typed);
  } else if (stored && open(stored.apiKey)) {
    sealed = stored.apiKey;
  } else {
    throw bad('apiKey is required the first time.');
  }
  const value: StoredEmail = { from, apiKey: sealed };
  await getDb().insert(appSettings).values({ key: 'email', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return getEmailSettings();
}

/** Forgets the saved settings; mail then falls back to the environment variables, if any. */
export async function clearEmailSettings(): Promise<EmailSettingsView> {
  await getDb().delete(appSettings).where(eq(appSettings.key, 'email'));
  return getEmailSettings();
}

export function assertEmail(v: unknown): string {
  const e = typeof v === 'string' ? v.trim() : '';
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) throw new ApiError(400, 'Enter a valid email address.');
  return e;
}
