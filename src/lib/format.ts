const TZ = 'Asia/Kolkata';
export function formatDay(date: string): { day: number; month: string; year: number } {
  const d = new Date(`${date}T12:00:00+05:30`);
  return {
    day: Number(d.toLocaleString('en-IN', { day: 'numeric', timeZone: TZ })),
    month: d.toLocaleString('en-IN', { month: 'short', timeZone: TZ }),
    year: Number(d.toLocaleString('en-IN', { year: 'numeric', timeZone: TZ })),
  };
}
export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}
