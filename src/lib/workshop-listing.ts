import { istParts } from './ist';
import { money } from './money';
import { validJoinLink } from './join-link';
import { bad, oneOf, optionalInt, optionalPhone, optionalRich, optionalText, validDate, type Raw } from './validate';

export const KINDS = ['workshop', 'meetup', 'popup', 'market', 'class'] as const;
export const MODES = ['in_person', 'online', 'hybrid'] as const;
export const LEVELS = ['beginner', 'intermediate', 'advanced', 'all'] as const;
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Kind = (typeof KINDS)[number];
export type Mode = (typeof MODES)[number];
export type Level = (typeof LEVELS)[number];
export type Day = (typeof DAYS)[number];

export type Week = 1 | 2 | 3 | 4 | 'last';
/** `repeat` weekly: on `days` every week. Monthly: on `days` of the listed `weeks` of every month (for example the 1st and 3rd Saturday). */
export type Schedule = { repeat?: 'weekly' | 'monthly'; days: Day[]; weeks?: Week[]; time: string; durationMin: number };
export type PriceRow = { label: string; amountPaise: number; sessions: number | null };
export type ListingFields = {
  kind: Kind; mode: Mode; topicId: number | null; platform: string | null; schedule: Schedule | null; endsOn: string | null;
  languages: string[]; level: Level | null; experience: string | null; certifications: string | null; freeTrial: boolean; freeTrialDays: number | null; joinLink: string | null;
  whatsapp: string | null; instagram: string | null; website: string | null; prices: PriceRow[];
  /** Craft and art workshops: what people make (up to 3), what is included and what to bring (up to 6 lines each), the minimum age. */
  makes: Make[]; included: string[]; bring: string[]; minAge: number | null;
};
export type Make = { title: string; text: string };
const MAX_MAKES = 3;
const MAX_LINES = 6;

const WEEKS: Week[] = [1, 2, 3, 4, 'last'];
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

/** The instructor's meeting link: a plain https link, up to 500 characters. It is private: staff see it, the public never does. */
function optionalJoinLink(v: unknown): string | null {
  const t = optionalText(v, 'joinLink', 500);
  if (!t) return null;
  if (!validJoinLink(t)) throw bad('joinLink must be a full https link, for example https://zoom.us/j/123.');
  return t;
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
  const repeat = s.repeat === undefined || s.repeat === null ? 'weekly' : s.repeat;
  if (repeat !== 'weekly' && repeat !== 'monthly') throw bad(msg);
  const base = { days: DAYS.filter(d => (days as string[]).includes(d)), time: s.time, durationMin };
  if (repeat === 'weekly') return { repeat, ...base };
  const weeks = s.weeks;
  if (!Array.isArray(weeks) || weeks.length < 1 || !weeks.every(w => w === 'last' || w === 1 || w === 2 || w === 3 || w === 4)) throw bad('schedule needs at least one week of the month (1st to 4th, or last).');
  const sorted = WEEKS.filter(w => (weeks as unknown[]).includes(w));
  return { repeat, days: base.days, weeks: sorted, time: base.time, durationMin };
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

export const CLASS_CONTACT_MESSAGE = 'An online class needs at least one way to contact the host: WhatsApp, Instagram, a website, or a phone number shown to the audience.';

function parseMakes(v: unknown): Make[] {
  if (v === undefined || v === null || v === '') return [];
  if (!Array.isArray(v) || v.length > MAX_MAKES) throw bad(`makes must be a list of up to ${MAX_MAKES} items, each with a title and a short line.`);
  return v.map(x => {
    const o = x && typeof x === 'object' && !Array.isArray(x) ? (x as Raw) : {};
    const title = optionalText(o.title, 'makes title', 60);
    if (!title) throw bad('makes: every item needs a title (up to 60 characters).');
    return { title, text: optionalText(o.text, 'makes text', 120) ?? '' };
  });
}

/** A list of short lines, from an array or from text with one item per line. Blank lines are dropped. */
function parseLines(v: unknown, field: string): string[] {
  if (v === undefined || v === null || v === '') return [];
  const raw = typeof v === 'string' ? v.split('\n') : v;
  if (!Array.isArray(raw)) throw bad(`${field} must be a list of short lines.`);
  const lines = raw.map(x => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  if (lines.length > MAX_LINES) throw bad(`${field} can have up to ${MAX_LINES} lines.`);
  if (lines.some(l => l.length > 80)) throw bad(`each line of ${field} must be 80 characters or fewer.`);
  return lines;
}

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
  const trialDays = optionalInt(raw.freeTrialDays, 'freeTrialDays', 1, 365);
  return {
    kind, mode, platform, schedule, level,
    topicId: optionalInt(raw.topicId, 'topicId', 1, 1_000_000),
    endsOn: raw.endsOn === undefined || raw.endsOn === null || raw.endsOn === '' ? null : validDate(raw.endsOn),
    languages: parseLanguages(raw.languages),
    experience: optionalRich(raw.experience, 'experience') ?? null,
    certifications: optionalRich(raw.certifications, 'certifications') ?? null,
    // The trial length in days is the free trial: giving it switches the trial on (an older client may still send freeTrial alone).
    freeTrial: raw.freeTrial === true || trialDays !== null,
    freeTrialDays: trialDays,
    joinLink: optionalJoinLink(raw.joinLink),
    whatsapp: (() => { const n = optionalPhone(raw.whatsapp, 'whatsapp'); return n ? `+91${n.slice(-10)}` : null; })(),
    instagram: optionalText(raw.instagram, 'instagram', 200) ?? null,
    website: optionalWebsite(raw.website) ?? null,
    prices: parsePrices(raw.prices),
    makes: parseMakes(raw.makes), included: parseLines(raw.included, 'included'), bring: parseLines(raw.bring, 'bring'),
    minAge: optionalInt(raw.minAge, 'minAge', 1, 99),
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

/**
 * Is the listing happening today (India time)? A one-day or multi-day event from its start to its last day; a class on its class days
 * (and chosen weeks of the month, when monthly) once it has started and until it ends.
 */
export function isLiveToday(w: Dated & { schedule?: Schedule | null }, now: Date = new Date()): boolean {
  const today = istParts(now).date;
  if (w.date > today || !isCurrent(w, now)) return false;
  if (!w.schedule) return true;
  const d = new Date(`${today}T00:00:00Z`);
  if (!w.schedule.days.includes(DAYS[(d.getUTCDay() + 6) % 7])) return false;
  if (w.schedule.repeat !== 'monthly') return true;
  const dom = d.getUTCDate();
  const week = Math.ceil(dom / 7);
  const isLast = dom + 7 > new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return (w.schedule.weeks ?? []).some(x => (x === 'last' ? isLast : x === week));
}

const DAY_LABEL: Record<Day, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const ORDINAL: Record<string, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', last: 'last' };
const andList = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
export function describeSchedule(s: Schedule): string {
  const days = DAYS.filter(d => s.days.includes(d)).map(d => DAY_LABEL[d]).join(', ');
  const [h, m] = s.time.split(':').map(Number);
  const clock = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  if (s.repeat === 'monthly' && s.weeks?.length) {
    const weeks = andList(WEEKS.filter(w => s.weeks!.includes(w)).map(w => ORDINAL[String(w)]));
    return `${weeks.charAt(0).toUpperCase()}${weeks.slice(1)} ${days} of every month at ${clock}, ${s.durationMin} min`;
  }
  return `${days} at ${clock}, ${s.durationMin} min`;
}

export function summarizePrices(rows: PriceRow[]): { from: string; all: string[] } {
  const { type, pricePaise } = priceCache(rows);
  return {
    from: type === 'FREE' ? 'Free' : `From ${money(pricePaise)}`,
    all: rows.map(r => `${r.label}: ${r.amountPaise === 0 ? 'Free' : money(r.amountPaise)}${r.sessions ? ` (${r.sessions} ${r.sessions === 1 ? 'session' : 'sessions'})` : ''}`),
  };
}
