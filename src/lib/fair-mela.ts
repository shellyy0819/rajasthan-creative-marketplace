import type { QuestId } from './fair-constants';

/**
 * The Pushkar Camel Fair week, as IST calendar dates, by year. While it runs the fair dresses for it: camels and hay on the lanes for the trading days,
 * Pushkar Lake on the last night, and quests that follow what is happening at Pushkar. Years that are not listed have no mela.
 */
export type MelaPhase = 'trade' | 'culture' | 'purnima';
export type Mela = { phase: MelaPhase; label: string; blurb: string };

type Year = { trade: [string, string]; culture: [string, string]; purnima: string; labels: Record<MelaPhase, string> };
export const MELA_DAYS: Record<number, Year> = {
  2026: {
    trade: ['2026-11-17', '2026-11-20'], culture: ['2026-11-21', '2026-11-23'], purnima: '2026-11-24',
    labels: { trade: 'Livestock trading · 17 to 20 Nov', culture: 'Cultural events · 21 to 23 Nov', purnima: 'Kartik Purnima · 24 Nov' },
  },
};
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

/** Which part of the mela an IST calendar day (yyyy-mm-dd) falls in, or null outside it. */
export function melaPhaseOf(day: string): MelaPhase | null {
  const y = MELA_DAYS[Number(day.slice(0, 4))];
  if (!y) return null;
  if (day >= y.trade[0] && day <= y.trade[1]) return 'trade';
  if (day >= y.culture[0] && day <= y.culture[1]) return 'culture';
  return day === y.purnima ? 'purnima' : null;
}
/** The mela for a day (its phase, a short label and a line about it), or null. */
export function melaOf(day: string): Mela | null {
  const phase = melaPhaseOf(day);
  return phase ? { phase, label: MELA_DAYS[Number(day.slice(0, 4))].labels[phase], blurb: BLURB[phase] } : null;
}
/** `?day=2026-11-18` pretends it is that day, so the mela can be tried before it starts. Returns null for anything that is not a real date. */
export function dayFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get('day');
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}
