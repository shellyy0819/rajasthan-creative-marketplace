import { describe, it, expect } from 'vitest';
import { VISITOR_COOKIE, clientIp, isBot, isVisitorId, likeActor, newVisitorId, readCookie, viewerActor, visitorCookie } from '@/lib/actors';

const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });

describe('visitor cookie', () => {
  it('generates uuid v4 ids and validates them strictly', () => {
    const id = newVisitorId();
    expect(isVisitorId(id)).toBe(true);
    for (const bad of ['', 'abc', id + 'x', id.toUpperCase().replace(/-/g, ''), '../../etc', 5, null, undefined]) expect(isVisitorId(bad)).toBe(false);
  });
  it('reads one named cookie out of a Cookie header, tolerating spacing and encoded values', () => {
    expect(readCookie('a=1; rr_vid=abc; b=2', 'rr_vid')).toBe('abc');
    expect(readCookie('rr_vid=abc', 'rr_vid')).toBe('abc');
    expect(readCookie('xrr_vid=nope; rr_vid2=nope', 'rr_vid')).toBeUndefined();
    expect(readCookie(null, 'rr_vid')).toBeUndefined();
    expect(readCookie('rr_vid=a%20b', 'rr_vid')).toBe('a b');
  });
  it('builds a safe Set-Cookie: HttpOnly, SameSite=Lax, one year, Secure only on https', () => {
    const id = newVisitorId();
    const c = visitorCookie(id, true);
    expect(c).toBe(`${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`);
    expect(visitorCookie(id, false)).not.toContain('Secure');
  });
});

describe('likeActor', () => {
  it('signed-in users are identified by lower-cased email, everyone else by visitor id', () => {
    expect(likeActor({ email: 'Me@X.co', visitorId: 'v1' })).toBe('u:me@x.co');
    expect(likeActor({ email: null, visitorId: 'v1' })).toBe('v:v1');
    expect(likeActor({ email: '  ', visitorId: 'v1' })).toBe('v:v1');
  });
});

describe('clientIp / isBot', () => {
  it('takes the first x-forwarded-for hop, then x-real-ip, else "unknown"', () => {
    expect(clientIp(h({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientIp(h({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(h({}))).toBe('unknown');
  });
  it('flags crawlers, tools and empty user agents but not browsers', () => {
    for (const ua of ['Googlebot/2.1', 'bingbot', 'facebookexternalhit/1.1', 'curl/8.0', 'python-requests/2', 'HeadlessChrome/120', 'Lighthouse', 'AhrefsBot', '', null]) expect(isBot(ua as string | null)).toBe(true);
    for (const ua of ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148']) expect(isBot(ua)).toBe(false);
  });
});

describe('viewerActor (privacy-friendly daily hash)', () => {
  const base = { ip: '1.2.3.4', userAgent: 'UA', salt: 'pepper' };
  it('is stable within a UTC day and different the next day, for another ip/ua, or another salt', () => {
    const a = viewerActor({ ...base, now: new Date('2026-10-20T01:00:00Z') });
    expect(a).toMatch(/^h:[0-9a-f]{32}$/);
    expect(viewerActor({ ...base, now: new Date('2026-10-20T23:00:00Z') })).toBe(a);
    for (const other of [{ now: new Date('2026-10-21T01:00:00Z') }, { ip: '1.2.3.5' }, { userAgent: 'UB' }, { salt: 'other' }])
      expect(viewerActor({ ...base, now: new Date('2026-10-20T01:00:00Z'), ...other })).not.toBe(a);
  });
  it('never contains the ip or user agent', () => {
    const a = viewerActor({ ip: '203.0.113.77', userAgent: 'SecretAgent/1', salt: 's' });
    expect(a).not.toContain('203'); expect(a.toLowerCase()).not.toContain('secretagent');
  });
});
