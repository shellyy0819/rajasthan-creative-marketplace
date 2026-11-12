/**
 * The fair follows the visitor's own clock: sunny mornings, a busy afternoon, golden evenings and chilly nights.
 * Everything here is a plain function of the hour (0 to 24, in the visitor's timezone), so it is easy to test.
 */
export type DayPhase = 'morning' | 'afternoon' | 'evening' | 'night';
export type Sky = {
  /** How dark and blue the air is (0 to 1). */
  dark: number;
  /** A warm amber wash: low sun in the morning and evening. */
  warm: number;
  /** How strongly the lamps, diyas and string lights glow. */
  lamps: number;
  /** Slanting sunbeams, strongest in the morning. */
  beams: number;
  /** Ground mist and visible breath on cold nights. */
  chill: number;
};

type Key = [hour: number, ...values: number[]];
const lerpKeys = (keys: Key[], h: number): number[] => {
  const hour = ((h % 24) + 24) % 24;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (hour <= b[0]) { const t = b[0] === a[0] ? 1 : (hour - a[0]) / (b[0] - a[0]); return a.slice(1).map((v, j) => v + (b[j + 1] - v) * t); }
  }
  return keys[keys.length - 1].slice(1);
};
const SKY: Key[] = [
  [0, .36, 0, 1, 0, 1], [5, .32, 0, 1, 0, .9], [6.5, .12, .14, .5, .5, .45], [8, 0, .12, 0, .9, .1], [10, 0, .06, 0, .55, 0], [12, 0, .02, 0, .15, 0],
  [15, 0, .02, 0, 0, 0], [17, 0, .1, 0, 0, 0], [18.5, .08, .16, .5, 0, .1], [20, .28, .04, .9, 0, .6], [22, .35, 0, 1, 0, .9], [24, .36, 0, 1, 0, 1],
];
export function skyAt(hour: number): Sky {
  const [dark, warm, lamps, beams, chill] = lerpKeys(SKY, hour);
  return { dark, warm, lamps, beams, chill };
}
/** How many shoppers wander the fair: a few at night, more through the morning, the most in the afternoon. */
const CROWD: Key[] = [[0, 3], [6, 3], [8, 5], [11, 8], [13, 9], [16, 8], [18, 6], [20, 4], [22, 3], [24, 3]];
export const MAX_CROWD = 9;
export const crowdAt = (hour: number) => Math.max(0, Math.min(MAX_CROWD, Math.round(lerpKeys(CROWD, hour)[0])));

export function phaseAt(hour: number): DayPhase {
  const h = ((hour % 24) + 24) % 24;
  return h < 5 || h >= 20 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
export const PHASE_LABEL: Record<DayPhase, string> = { morning: 'Sunny morning', afternoon: 'Busy afternoon', evening: 'Golden evening', night: 'Chilly night' };
export const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;
/** `?time=night` (or morning, afternoon, evening) and `?hour=13.5` let anyone preview another time of day. */
const PHASE_HOUR: Record<DayPhase, number> = { morning: 8, afternoon: 14, evening: 18.5, night: 23 };
export function hourFromSearch(search: string): number | null {
  const q = new URLSearchParams(search), t = q.get('time'), h = q.get('hour');
  if (t && t in PHASE_HOUR) return PHASE_HOUR[t as DayPhase];
  const n = h === null ? NaN : Number(h);
  return Number.isFinite(n) && n >= 0 && n < 24 ? n : null;
}
