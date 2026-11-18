import type { HostPath } from './host-link';

/** The host form saves what has been typed in this browser, so someone who closes the form or leaves the page can pick up where they stopped. */
export const DRAFT_KEY = 'craftofy:host-draft:v1';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PriceRowDraft = { label: string; amount: string; sessions: string };
export type HostDraft = {
  savedAt: number; path: HostPath | null; step: number; startDate: string; paid: boolean; repeat: 'weekly' | 'monthly';
  priceRows: PriceRowDraft[]; fields: Record<string, string>; days: string[]; weeks: string[]; freeTrial: boolean; images: string[];
};

/**
 * Fields that are never saved: the spam trap, the emailed code, the ones kept in their own lists below, and everything that identifies
 * a person (name, email, phone, WhatsApp, host name). A draft sits in the browser on a possibly shared device, so it holds only the event
 * details; the person's own details are typed again or pre-filled from their account.
 */
export const PERSONAL_FIELDS = ['contactName', 'email', 'phone', 'whatsapp', 'hostName'] as const;
const SKIP = new Set(['companyWebsite', 'code', 'images', 'days', 'weeks', 'freeTrial', 'path', ...PERSONAL_FIELDS]);

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

export function readDraft(now = Date.now()): HostDraft | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<HostDraft> | null;
    if (!d || typeof d !== 'object' || typeof d.savedAt !== 'number' || now - d.savedAt > DRAFT_TTL_MS || d.savedAt > now + 60_000) return null;
    if (!d.fields || typeof d.fields !== 'object' || !isStrings(d.days) || !isStrings(d.weeks) || !isStrings(d.images) || !Array.isArray(d.priceRows)) return null;
    if (d.path !== null && d.path !== 'event' && d.path !== 'class') return null;
    return d as HostDraft;
  } catch { return null; }
}

export function writeDraft(d: HostDraft): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage full or blocked: the form still works without a draft */ }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
}

/** Reads what is typed into the form (text, selects, ticked days and weeks, uploaded photo urls). */
export function collectDraft(form: HTMLFormElement, state: Pick<HostDraft, 'path' | 'step' | 'startDate' | 'paid' | 'repeat' | 'priceRows'>, now = Date.now()): HostDraft {
  const f = new FormData(form);
  const fields: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === 'string' && !SKIP.has(k) && v !== '') fields[k] = v;
  return {
    savedAt: now, ...state, fields,
    days: f.getAll('days').map(String), weeks: f.getAll('weeks').map(String), freeTrial: f.get('freeTrial') === 'on', images: f.getAll('images').map(String).filter(Boolean),
  };
}
