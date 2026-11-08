import { describe, it, expect, afterEach } from 'vitest';
import { auth, authOptions } from '@/auth';

describe('auth fails closed without NEXTAUTH_SECRET', () => {
  const orig = process.env.NEXTAUTH_SECRET;
  afterEach(() => {
    if (orig === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = orig;
  });
  it('auth() throws instead of using next-auth\'s guessable dev secret', async () => {
    delete process.env.NEXTAUTH_SECRET;
    await expect(auth()).rejects.toThrow(/NEXTAUTH_SECRET/);
  });
  it('authOptions.secret is the env secret so route handler and getServerSession agree', () => {
    process.env.NEXTAUTH_SECRET = 'abc';
    expect(authOptions.secret).toBe('abc');
  });
});

describe('auth across the public and dashboard hosts', () => {
  const keep = { COOKIE_DOMAIN: process.env.COOKIE_DOMAIN, DASHBOARD_URL: process.env.DASHBOARD_URL, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, NEXTAUTH_URL: process.env.NEXTAUTH_URL };
  afterEach(() => { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const opts = async () => (await import('@/auth')).buildAuthOptions();

  it('without COOKIE_DOMAIN the session cookie is next-auth\'s default (host only)', async () => {
    delete process.env.COOKIE_DOMAIN;
    expect((await opts()).cookies).toBeUndefined();
  });
  it('with COOKIE_DOMAIN the session cookie is shared by both subdomains, secure on https, httpOnly and lax', async () => {
    process.env.COOKIE_DOMAIN = '.example.com'; process.env.NEXTAUTH_URL = 'https://www.example.com';
    const c = (await opts()).cookies!.sessionToken!;
    expect(c.name).toBe('__Secure-next-auth.session-token');
    expect(c.options).toMatchObject({ domain: '.example.com', httpOnly: true, sameSite: 'lax', path: '/', secure: true });
  });
  it('on plain http (local test) the cookie name has no __Secure- prefix and is not marked secure', async () => {
    process.env.COOKIE_DOMAIN = 'localhost'; process.env.NEXTAUTH_URL = 'http://localhost:3000';
    const c = (await opts()).cookies!.sessionToken!;
    expect(c.name).toBe('next-auth.session-token');
    expect(c.options.secure).toBe(false);
  });
  it('a COOKIE_DOMAIN that does not cover the dashboard host is ignored (the cookie would not be sent there)', async () => {
    process.env.COOKIE_DOMAIN = '.other.com'; process.env.NEXTAUTH_URL = 'https://www.example.com';
    process.env.DASHBOARD_URL = 'https://dashboard.example.com'; process.env.NEXT_PUBLIC_SITE_URL = 'https://www.example.com';
    expect((await opts()).cookies).toBeUndefined();
  });
  it('the redirect callback only returns to this site or the dashboard host, never elsewhere', async () => {
    process.env.NEXTAUTH_URL = 'https://www.example.com'; process.env.NEXT_PUBLIC_SITE_URL = 'https://www.example.com'; process.env.DASHBOARD_URL = 'https://dashboard.example.com';
    const redirect = (await opts()).callbacks!.redirect!;
    const base = 'https://www.example.com';
    expect(await redirect({ url: '/shop', baseUrl: base })).toBe('https://www.example.com/shop');
    expect(await redirect({ url: 'https://www.example.com/shop', baseUrl: base })).toBe('https://www.example.com/shop');
    expect(await redirect({ url: 'https://dashboard.example.com/dashboard/posts', baseUrl: base })).toBe('https://dashboard.example.com/dashboard/posts');
    const dflt = base + '/sell'; // anything unsafe falls back to the default
    for (const bad of ['https://evil.example.org/phish', 'https://dashboard.example.com.evil.org/x', '//evil.example.org/x', 'javascript:alert(1)', 'https://evil.example', '/\\evil.example', '\\\\evil.example', '/\\/evil.example', 'https://dashboard.example.com@evil.example/x', 'https://dashboard.example.com\\@evil.example/x', 'data:text/html,x'])
      expect(await redirect({ url: bad, baseUrl: base }), bad).toBe(dflt);
  });
});

describe('auth pages', () => {
  it('uses the Craftofy sign-in page for sign-in and for provider errors', () => {
    expect(authOptions.pages).toEqual({ signIn: '/signin', error: '/signin' });
  });
});
