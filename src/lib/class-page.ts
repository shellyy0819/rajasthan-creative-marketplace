import { instagramUrl } from './social';
import { istParts, istToDate } from './ist';
import { DAYS, type Schedule } from './workshop-listing';
import type { Workshop } from './types';

type Runs = { date: string; endsOn?: string | null; schedule?: Schedule | null };
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(new Date(utc(date).getTime() + n * 86_400_000));

/** "6:30 am" from "06:30". */
export function clock12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** Does the class meet on this India-time date? Inside its run, on a class day, and on a chosen week when it is monthly. */
export function meetsOn(w: Runs, date: string): boolean {
  const s = w.schedule;
  if (!s || date < w.date || (w.endsOn && date > w.endsOn)) return false;
  const d = utc(date);
  if (!s.days.includes(DAYS[(d.getUTCDay() + 6) % 7])) return false;
  if (s.repeat !== 'monthly') return true;
  const dom = d.getUTCDate();
  const week = Math.ceil(dom / 7);
  const isLast = dom + 7 > new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return (s.weeks ?? []).some(x => (x === 'last' ? isLast : x === week));
}

export type NextSession = { date: string; time: string; startsAt: Date; live: boolean };

/** The class that is on now or the next one that starts, or null (no schedule, or it has ended). Looks up to 62 days ahead. */
export function nextSession(w: Runs, now: Date = new Date()): NextSession | null {
  const s = w.schedule;
  if (!s) return null;
  const today = istParts(now).date;
  for (let i = 0; i < 62; i++) {
    const date = addDays(today, i);
    if (w.endsOn && date > w.endsOn) return null;
    if (!meetsOn(w, date)) continue;
    const startsAt = istToDate(date, s.time);
    const endsAt = new Date(startsAt.getTime() + s.durationMin * 60_000);
    if (now >= endsAt) continue;
    return { date, time: s.time, startsAt, live: now >= startsAt };
  }
  return null;
}

/** "Today, 6:30 am IST · starts in 30 min", "Tomorrow, 6:30 am IST", "Monday 23 Nov, 6:30 am IST". */
export function describeNext(n: NextSession, now: Date = new Date()): string {
  const today = istParts(now).date;
  const at = `${clock12(n.time)} IST`;
  if (n.date === today) {
    if (n.live) return `Today, ${at} · live now`;
    const mins = Math.max(1, Math.round((n.startsAt.getTime() - now.getTime()) / 60_000));
    return `Today, ${at} · starts in ${mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}` : `${mins} min`}`;
  }
  if (n.date === addDays(today, 1)) return `Tomorrow, ${at}`;
  const d = utc(n.date);
  return `${DAY_NAME[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}, ${at}`;
}

export type WeekDay = { date: string; label: string; dom: number; state: 'done' | 'today' | 'upcoming' | 'rest'; time?: string };

/** Monday to Sunday of the current India-time week: which days the class met, meets today, meets later, or rests. */
export function weekStrip(w: Runs, now: Date = new Date()): WeekDay[] {
  const today = istParts(now).date;
  const monday = addDays(today, -((utc(today).getUTCDay() + 6) % 7));
  return DAY_SHORT.map((label, i) => {
    const date = addDays(monday, i);
    const meets = meetsOn(w, date);
    const state = !meets ? 'rest' : date < today ? 'done' : date === today ? 'today' : 'upcoming';
    return { date, label, dom: utc(date).getUTCDate(), state, ...(meets && w.schedule ? { time: clock12(w.schedule.time) } : {}) };
  });
}

export type ChannelKind = 'whatsapp' | 'call' | 'instagram' | 'website';
export type Channel = { kind: ChannelKind; label: string; short: string; href: string };
type Contacts = Pick<Workshop, 'whatsapp' | 'instagram' | 'website' | 'publicPhone'>;

/**
 * How a visitor can reach the host, from the public details only. The main button is a phone channel (WhatsApp, else a shown phone number);
 * when there is no phone at all, the other channels are offered instead (Instagram first). `icons` lists every channel that exists.
 */
export function contactChannels(w: Contacts): { primary: Channel | null; secondary: Channel[]; icons: Channel[] } {
  const digits = (n: string) => n.replace(/\D/g, '');
  const site = w.website && /^https?:\/\//i.test(w.website) ? w.website : null;
  const whatsapp: Channel | null = w.whatsapp ? { kind: 'whatsapp', label: 'Chat on WhatsApp', short: 'WhatsApp', href: `https://wa.me/${digits(w.whatsapp)}` } : null;
  const call: Channel | null = w.publicPhone ? { kind: 'call', label: 'Call the host', short: 'Call', href: `tel:${w.publicPhone}` } : null;
  const instagram: Channel | null = w.instagram ? { kind: 'instagram', label: 'Open Insta', short: 'Instagram', href: instagramUrl(w.instagram) } : null;
  const website: Channel | null = site ? { kind: 'website', label: 'Visit website', short: 'Website', href: site } : null;
  const icons = [instagram, whatsapp, call, website].filter((c): c is Channel => !!c);
  const phone = whatsapp ?? call;
  if (phone) return { primary: phone, secondary: [], icons };
  const others = [instagram, website].filter((c): c is Channel => !!c);
  return { primary: others[0] ?? null, secondary: others.slice(1), icons };
}
