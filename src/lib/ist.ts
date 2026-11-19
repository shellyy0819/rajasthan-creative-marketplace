// India time helpers: pure, so browser components can use them too (no database imports).
const IST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function istParts(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(IST_PARTS.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export const istToDate = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);
