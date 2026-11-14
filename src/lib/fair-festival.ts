/** Diwali (the main day, Lakshmi Puja) by year, as IST calendar dates. The fair shows its diyas up to the end of that day and a few days after, then puts them away. */
export const DIWALI_DAYS: Record<number, string> = { 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17', 2029: '2029-11-05', 2030: '2030-10-26' };
const AFTER_DAYS = 2;
const DAY = 86_400_000;
const IST = 330 * 60_000;

/** The IST calendar date (yyyy-mm-dd) of an instant. */
function istDate(d: Date) { return new Date(d.getTime() + IST).toISOString().slice(0, 10); }

/** True once this year's Diwali is in the past (a couple of days after the day itself); false before it and when the year is not listed. */
export function diwaliOver(now: Date): boolean {
  const today = istDate(now), year = Number(today.slice(0, 4));
  const day = DIWALI_DAYS[year];
  if (!day) return false;
  return Date.parse(today) > Date.parse(day) + AFTER_DAYS * DAY;
}
