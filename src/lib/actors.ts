import crypto from 'node:crypto';

export const VISITOR_COOKIE = 'rr_vid';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const newVisitorId = () => crypto.randomUUID();
export const isVisitorId = (v: unknown): v is string => typeof v === 'string' && UUID_V4.test(v);

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return undefined; } }
  }
  return undefined;
}
export const visitorCookie = (id: string, secure: boolean) =>
  `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

export const likeActor = ({ email, visitorId }: { email?: string | null; visitorId: string }) =>
  email && email.trim() ? `u:${email.trim().toLowerCase()}` : `v:${visitorId}`;

export function clientIp(h: { get(name: string): string | null }): string {
  const xff = h.get('x-forwarded-for')?.split(',')[0].trim();
  return xff || h.get('x-real-ip')?.trim() || 'unknown';
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|lighthouse|pagespeed|python-requests|curl|wget|httpclient|monitor|uptime|preview/i;
export const isBot = (ua: string | null | undefined) => !ua || !ua.trim() || BOT.test(ua);

/** One value per visitor per UTC day. Salted and hashed: the ip and user agent are never stored and cannot be linked across days. */
export function viewerActor({ ip, userAgent, now = new Date(), salt = process.env.ANALYTICS_SALT ?? process.env.NEXTAUTH_SECRET ?? 'dev-only-salt' }: { ip: string; userAgent: string; now?: Date; salt?: string }): string {
  const day = now.toISOString().slice(0, 10);
  return 'h:' + crypto.createHash('sha256').update(`${day}|${ip}|${userAgent}|${salt}`).digest('hex').slice(0, 32);
}
