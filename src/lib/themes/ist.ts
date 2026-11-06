const IST_OFFSET_MS = 330 * 60_000;
const RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parses 'YYYY-MM-DDTHH:mm' as Indian Standard Time (+05:30). Throws on malformed input. */
export function istToDate(s: string): Date {
  const m = typeof s === 'string' ? RE.exec(s) : null;
  if (!m) throw new Error(`Invalid IST date-time: ${String(s)}`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const probe = new Date(utc);
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d || h > 23 || mi > 59) {
    throw new Error(`Invalid IST date-time: ${s}`);
  }
  return new Date(utc - IST_OFFSET_MS);
}

export function dateToIst(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}
