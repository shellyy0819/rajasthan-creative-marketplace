import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { appSettings } from '../db/schema';
import { listActiveCities } from './cities';
import { open, seal } from './secret-box';
import { bad, obj, optionalText } from './validate';

/**
 * The Gemini model used when none is saved. It is one constant so it is easy to change when Google retires a model.
 * Checked on 2026-11-25 against Google's model list (aistudio.google.com/docs/models, which ai.google.dev redirects to):
 * a current, generally available (not preview) Flash model that supports JSON output, which is all the headline summary needs.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/** What the admin screen may see: never the key itself, only whether one is saved and its last 4 characters. */
export type TrendSettingsView = { keySet: boolean; keyHint?: string; model: string; region: string; source: 'saved' | 'environment' | 'none';
  /** A settings row exists, even when its key cannot be read (so it can still be removed). */ hasStoredRow: boolean };
/** What the research code uses. `region` is empty when there is nothing typed and no city is listed. */
export type GeminiConfig = { apiKey: string; model: string; region: string };

/**
 * The saved row (app_settings key 'trends'). The key is sealed and absent when the key comes from the environment; model and region are left out
 * when blank (a model equal to the default is left out too, so it follows the default).
 */
type StoredTrends = { apiKey?: string /* sealed */; model?: string; region?: string };

const clean = (v: string | undefined) => (v ?? '').trim();
const envKey = (env: Record<string, string | undefined> = process.env) => clean(env.GEMINI_API_KEY);

async function readStored(): Promise<StoredTrends | null> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, 'trends'));
  const v = row?.value as Partial<StoredTrends> | undefined;
  if (!v || typeof v !== 'object') return null;
  return { ...(typeof v.apiKey === 'string' ? { apiKey: v.apiKey } : {}), ...(typeof v.model === 'string' && v.model ? { model: v.model } : {}), ...(typeof v.region === 'string' && v.region ? { region: v.region } : {}) };
}

/** The key, model and region in use: what an admin saved on the Settings page, otherwise the GEMINI_API_KEY environment variable. */
export async function resolveGeminiConfig(): Promise<GeminiConfig | null> {
  const stored = await readStored().catch(() => null); // a database hiccup must not stop the env fallback
  const apiKey = (stored?.apiKey ? open(stored.apiKey) : null) ?? (envKey() || null);
  if (!apiKey) return null;
  const region = stored?.region ?? (await listActiveCities().catch(() => [])).map(c => c.name).join(', ');
  return { apiKey, model: stored?.model ?? DEFAULT_GEMINI_MODEL, region };
}

export async function getTrendSettings(): Promise<TrendSettingsView> {
  const stored = await readStored();
  const base = { model: stored?.model ?? DEFAULT_GEMINI_MODEL, region: stored?.region ?? '' };
  const saved = stored?.apiKey ? open(stored.apiKey) : null;
  const hasStoredRow = stored !== null;
  if (saved) return { keySet: true, keyHint: saved.slice(-4), ...base, source: 'saved', hasStoredRow };
  const env = envKey();
  if (env) return { keySet: true, keyHint: env.slice(-4), ...base, source: 'environment', hasStoredRow };
  return { keySet: false, ...base, source: 'none', hasStoredRow };
}

const MODEL_RE = /^[a-z0-9.-]{3,60}$/;
// Any visible ASCII, no spaces or control characters: Google's key format has changed before (the newer keys contain dots), and the key only
// travels in a request header, where a visible-ASCII value cannot inject anything.
const KEY_RE = /^[\x21-\x7E]{8,300}$/;

/**
 * Saves the key, model and region. A blank key keeps the saved one (with no saved key and a GEMINI_API_KEY in the environment it stays unsaved, so only the model and region are stored), a blank model puts the default back and a blank region means
 * "use the cities listed on the site". Error messages never include the key.
 */
export async function saveTrendSettings(input: unknown, actorEmail: string): Promise<TrendSettingsView> {
  const raw = obj(input);
  const typed = optionalText(raw.apiKey, 'key', 300);
  const stored = await readStored();
  let apiKey: string | undefined;
  if (typed) {
    if (!KEY_RE.test(typed)) throw bad('The Gemini key looks wrong. Paste it exactly as Google AI Studio shows it, with no spaces.');
    apiKey = seal(typed);
  } else if (stored && open(stored.apiKey)) apiKey = stored.apiKey;
  else if (!envKey()) throw bad('The Gemini key is required the first time.');
  if (raw.model !== undefined && raw.model !== null && typeof raw.model !== 'string') throw bad('model must be text like gemini-3.8-flash.');
  const model = typeof raw.model === 'string' ? raw.model.trim() : '';
  if (model && !MODEL_RE.test(model)) throw bad('model must be a Gemini model id: 3 to 60 lowercase letters, numbers, dots or hyphens.');
  const region = optionalText(raw.region, 'region', 200);
  const value: StoredTrends = { ...(apiKey ? { apiKey } : {}), ...(model && model !== DEFAULT_GEMINI_MODEL ? { model } : {}), ...(region ? { region } : {}) };
  await getDb().insert(appSettings).values({ key: 'trends', value, updatedBy: actorEmail })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorEmail, updatedAt: new Date() } });
  return getTrendSettings();
}

/** Forgets everything saved here (key, model and region); research then falls back to the GEMINI_API_KEY environment variable, if any. */
export async function clearTrendSettings(): Promise<TrendSettingsView> {
  await getDb().delete(appSettings).where(eq(appSettings.key, 'trends'));
  return getTrendSettings();
}
