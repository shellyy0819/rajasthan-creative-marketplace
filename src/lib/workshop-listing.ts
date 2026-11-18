import { istParts } from '@/db/mappers';
import { money } from './money';
import { bad, oneOf, optionalInt, optionalPhone, optionalText, validDate, type Raw } from './validate';

export const KINDS = ['workshop', 'meetup', 'popup', 'market', 'class'] as const;
export const MODES = ['in_person', 'online', 'hybrid'] as const;
export const LEVELS = ['beginner', 'intermediate', 'advanced', 'all'] as const;
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Kind = (typeof KINDS)[number];
export type Mode = (typeof MODES)[number];
export type Level = (typeof LEVELS)[number];
export type Day = (typeof DAYS)[number];

export type Schedule = { days: Day[]; time: string; durationMin: number };
export type PriceRow = { label: string; amountPaise: number; sessions: number | null };
export type ListingFields = {
  kind: Kind; mode: Mode; topicId: number | null; platform: string | null; schedule: Schedule | null; endsOn: string | null;
  languages: string[]; level: Level | null; experience: string | null; certifications: string | null; freeTrial: boolean;
  whatsapp: string | null; instagram: string | null; website: string | null; prices: PriceRow[];
};

const MAX_LANGUAGES = 5;
const MAX_PRICES = 5;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A web address typed without a scheme gets https://; anything that is not http(s) with a dotted host is refused. */
export function optionalWebsite(v: unknown): string | undefined {
  const raw = optionalText(v, 'website', 300);
  if (!raw) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try { u = new URL(withScheme); } catch { throw bad('website must be a web address like example.com.'); }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) throw bad('website must be a web address like example.com.');
  return withScheme;
}

function parseLanguages(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_LANGUAGES) throw bad(`languages must be a list of up to ${MAX_LANGUAGES} languages.`);
  return v.map(x => {
    const t = typeof x === 'string' ? x.trim() : '';
    if (t.length < 2 || t.length > 30) throw bad('languages must each be 2 to 30 characters.');
    return t;
  });
}

function parseSchedule(v: unknown): Schedule | null {
  if (v === undefined || v === null) return null;
  const msg = 'schedule needs class days, a time (HH:MM) and a duration of 15 to 480 minutes.';
  if (typeof v !== 'object' || Array.isArray(v)) throw bad(msg);
  const s = v as Raw;
  const days = s.days;
  if (!Array.isArray(days) || days.length < 1 || days.length > 7 || !days.every(d => (DAYS as readonly string[]).includes(d as string))) throw bad(msg);
  if (typeof s.time !== 'string' || !TIME_RE.test(s.time)) throw bad(msg);
  const durationMin = s.durationMin;
  if (typeof durationMin !== 'number' || !Number.isInteger(durationMin) || durationMin < 15 || durationMin > 480) throw bad(msg);
  return { days: Array.from(new Set(days as Day[])), time: s.time, durationMin };
}

function parsePrices(v: unknown): PriceRow[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_PRICES) throw bad(`prices must be a list of up to ${MAX_PRICES} price plans.`);
  return v.map(r => {
    const row = (r && typeof r === 'object' ? r : {}) as Raw;
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!label || label.length > 30) throw bad('prices: each plan needs a name of up to 30 characters.');
    if (typeof row.amountPaise !== 'number' || !Number.isInteger(row.amountPaise) || row.amountPaise < 0 || row.amountPaise > 10_000_000) throw bad('prices: each amount must be a whole number of paise from 0 to 10,000,000.');
    const sessions = row.sessions === undefined || row.sessions === null || row.sessions === '' ? null : row.sessions;
    if (sessions !== null && (typeof sessions !== 'number' || !Number.isInteger(sessions) || sessions < 1 || sessions > 1000)) throw bad('prices: sessions must be a whole number from 1 to 1000.');
    return { label, amountPaise: row.amountPaise, sessions };
  });
}

export const CLASS_CONTACT_MESSAGE = 'An online class needs at least one way to contact the host: WhatsApp, Instagram or a website.';

/** The fields an online class or a richer listing adds, validated the same way for a public request and for an admin listing. */
export function parseListingFields(raw: Raw): ListingFields {
  const kind = oneOf(raw.kind ?? 'workshop', 'kind', KINDS);
  const mode = oneOf(raw.mode ?? 'in_person', 'mode', MODES);
  if (kind === 'class' && mode === 'in_person') throw bad('An online class cannot be in person: choose online or hybrid as the mode.');
  const platform = optionalText(raw.platform, 'platform', 60) ?? null;
  const schedule = parseSchedule(raw.schedule);
  if (mode === 'online') {
    if (!platform) throw bad('platform is required for an online class (for example Zoom or Google Meet).');
    if (!schedule) throw bad('schedule is required for an online class.');
  }
  const level = raw.level === undefined || raw.level === null || raw.level === '' ? null : oneOf(raw.level, 'level', LEVELS);
  return {
    kind, mode, platform, schedule, level,
    topicId: optionalInt(raw.topicId, 'topicId', 1, 1_000_000),
    endsOn: raw.endsOn === undefined || raw.endsOn === null || raw.endsOn === '' ? null : validDate(raw.endsOn),
    languages: parseLanguages(raw.languages),
    experience: optionalText(raw.experience, 'experience', 500) ?? null,
    certifications: optionalText(raw.certifications, 'certifications', 500) ?? null,
    freeTrial: raw.freeTrial === true,
    whatsapp: (() => { const n = optionalPhone(raw.whatsapp, 'whatsapp'); return n ? `+91${n.slice(-10)}` : null; })(),
    instagram: optionalText(raw.instagram, 'instagram', 200) ?? null,
    website: optionalWebsite(raw.website) ?? null,
    prices: parsePrices(raw.prices),
  };
}

/** workshops.type and price_paise are derived from the price rows: FREE at 0 when nothing is charged, else PAID at the lowest paid plan. */
export function priceCache(rows: PriceRow[]): { type: 'FREE' | 'PAID'; pricePaise: number } {
  const paid = rows.map(r => r.amountPaise).filter(a => a > 0);
  return paid.length ? { type: 'PAID', pricePaise: Math.min(...paid) } : { type: 'FREE', pricePaise: 0 };
}

type Dated = { date: string; endsOn?: string | null; kind: string };
/** The last day (India time, YYYY-MM-DD) a listing is current; null for a class with no end date. */
export function lastDay(w: Dated): string | null {
  if (w.endsOn) return w.endsOn;
  return w.kind === 'class' ? null : w.date;
}
export function isCurrent(w: Dated, now: Date = new Date()): boolean {
  const last = lastDay(w);
  return last === null || last >= istParts(now).date;
}

const DAY_LABEL: Record<Day, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
export function describeSchedule(s: Schedule): string {
  const days = DAYS.filter(d => s.days.includes(d)).map(d => DAY_LABEL[d]).join(', ');
  const [h, m] = s.time.split(':').map(Number);
  const clock = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  return `${days} at ${clock}, ${s.durationMin} min`;
}

export function summarizePrices(rows: PriceRow[]): { from: string; all: string[] } {
  const { type, pricePaise } = priceCache(rows);
  return {
    from: type === 'FREE' ? 'Free' : `From ${money(pricePaise)}`,
    all: rows.map(r => `${r.label}: ${r.amountPaise === 0 ? 'Free' : money(r.amountPaise)}${r.sessions ? ` (${r.sessions} ${r.sessions === 1 ? 'session' : 'sessions'})` : ''}`),
  };
}
