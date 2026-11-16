import type { QuestId } from './fair-constants';

/**
 * The Pushkar Camel Fair week, as IST calendar dates, While it runs the fair dresses for it: camels and hay on the lanes for the trading days,
 * Pushkar Lake on the last night, and quests that follow what is happening at Pushkar. With no schedule set there is no mela.
 */
export type MelaPhase = 'trade' | 'culture' | 'purnima';
export type Mela = { phase: MelaPhase; label: string; blurb: string };

/** The dates of this year's mela (IST calendar dates, yyyy-mm-dd, inclusive). An admin sets them under Dashboard > Settings > Fair, because they change every year. */
export type MelaSchedule = { trade: [string, string]; culture: [string, string]; purnima: string };
export const DEFAULT_MELA: MelaSchedule = { trade: ['2026-11-17', '2026-11-20'], culture: ['2026-11-21', '2026-11-23'], purnima: '2026-11-24' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayOf = (d: string) => `${Number(d.slice(8))}`, monthOf = (d: string) => MONTHS[Number(d.slice(5, 7)) - 1];
/** "17 to 20 Nov", or "30 Nov to 2 Dec" across a month end. */
const range = (a: string, b: string) => (a === b ? `${dayOf(a)} ${monthOf(a)}` : a.slice(0, 7) === b.slice(0, 7) ? `${dayOf(a)} to ${dayOf(b)} ${monthOf(b)}` : `${dayOf(a)} ${monthOf(a)} to ${dayOf(b)} ${monthOf(b)}`);
const labelsOf = (m: MelaSchedule): Record<MelaPhase, string> => ({ trade: `Livestock trading · ${range(...m.trade)}`, culture: `Cultural events · ${range(...m.culture)}`, purnima: `Kartik Purnima · ${range(m.purnima, m.purnima)}` });

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toJSON()?.slice(0, 10) === v;
/** The schedule from stored or submitted JSON, or null when it is not a complete, sensible one (each part in order, and the parts one after another). */
export function parseMelaSchedule(v: unknown): MelaSchedule | null {
  const r = v as { trade?: unknown[]; culture?: unknown[]; purnima?: unknown } | null;
  if (!r || typeof r !== 'object' || !Array.isArray(r.trade) || !Array.isArray(r.culture)) return null;
  const [t0, t1, c0, c1, p] = [r.trade[0], r.trade[1], r.culture[0], r.culture[1], r.purnima];
  if (!isDate(t0) || !isDate(t1) || !isDate(c0) || !isDate(c1) || !isDate(p)) return null;
  return t0 <= t1 && t1 < c0 && c0 <= c1 && c1 < p ? { trade: [t0, t1], culture: [c0, c1], purnima: p } : null;
}
const BLURB: Record<MelaPhase, string> = {
  trade: 'The camel traders are in town. Look for the camels on the lanes, meet the makers and find a gift under ₹500.',
  culture: 'Contest days at Pushkar: camel decoration, turban-tying and the longest mustache. Try something on at the mirror and pin a note.',
  purnima: 'Kartik Purnima, the holy bath day. Click Pushkar Lake and join the devotees for the holy dip.',
};
/** The three quests each phase asks for. Quests the fair cannot offer (no mirror, no lake) are dropped and replaced by others. */
export const MELA_QUESTS: Record<MelaPhase, QuestId[]> = {
  trade: ['meet3', 'gift500', 'tryon'],
  culture: ['meet3', 'selfie', 'note'],
  purnima: ['meet3', 'dip', 'note'],
};

/** Things to do at Pushkar during the mela. The balloon floats over the fair, music and sports have a place on the floor, and the market is the stalls themselves. */
export type ActivityId = 'balloon' | 'music' | 'sports' | 'market';
export const ACTIVITIES: Array<{ id: ActivityId; name: string; line: string }> = [
  { id: 'balloon', name: 'Hot air balloon rides', line: 'Float over the fair' },
  { id: 'music', name: 'Folk music', line: 'Sit down at the stage' },
  { id: 'sports', name: 'Rural sports', line: 'Join a tug of war' },
  { id: 'market', name: 'Handicraft market', line: 'Browse the stalls' },
];

/** Which part of the mela an IST calendar day (yyyy-mm-dd) falls in, or null outside it. */
export function melaPhaseOf(day: string, y: MelaSchedule | null = DEFAULT_MELA): MelaPhase | null {
  if (!y) return null;
  if (day >= y.trade[0] && day <= y.trade[1]) return 'trade';
  if (day >= y.culture[0] && day <= y.culture[1]) return 'culture';
  return day === y.purnima ? 'purnima' : null;
}
/** The mela for a day (its phase, a short label and a line about it), or null. */
export function melaOf(day: string, y: MelaSchedule | null = DEFAULT_MELA): Mela | null {
  const phase = melaPhaseOf(day, y);
  return phase && y ? { phase, label: labelsOf(y)[phase], blurb: BLURB[phase] } : null;
}
/** `?day=2026-11-18` pretends it is that day, so the mela can be tried before it starts. Returns null for anything that is not a real date. */
export function dayFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get('day');
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}
