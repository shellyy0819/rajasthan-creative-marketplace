import { describe, it, expect } from 'vitest';
import { hostConfig, normalizeHost, routeFor, signInUrl, type HostConfig } from '@/lib/hosts';

const split: HostConfig = { dashboardHost: 'dashboard.example.com', dashboardOrigin: 'https://dashboard.example.com', publicOrigin: 'https://www.example.com' };
const single: HostConfig = {};

describe('hostConfig', () => {
  it('reads DASHBOARD_URL and NEXT_PUBLIC_SITE_URL, ignoring case, ports in the host, trailing slashes and junk', () => {
    expect(hostConfig({ DASHBOARD_URL: 'https://Dashboard.Example.com/', NEXT_PUBLIC_SITE_URL: 'https://www.example.com/' })).toEqual(split);
    expect(hostConfig({ DASHBOARD_URL: 'http://localhost:4000', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' })).toEqual({ dashboardHost: 'localhost:4000', dashboardOrigin: 'http://localhost:4000', publicOrigin: 'http://localhost:3000' });
  });
  it('without DASHBOARD_URL (or with an invalid one) the app runs in single-host mode', () => {
    expect(hostConfig({})).toEqual({});
    expect(hostConfig({ NEXT_PUBLIC_SITE_URL: 'https://www.example.com' })).toEqual({});
    expect(hostConfig({ DASHBOARD_URL: 'not a url', NEXT_PUBLIC_SITE_URL: 'https://www.example.com' })).toEqual({});
    expect(hostConfig({ DASHBOARD_URL: 'ftp://x.example.com', NEXT_PUBLIC_SITE_URL: 'https://www.example.com' })).toEqual({});
  });
  it('a dashboard URL equal to the public URL is rejected (it would redirect forever)', () => {
    expect(hostConfig({ DASHBOARD_URL: 'https://www.example.com', NEXT_PUBLIC_SITE_URL: 'https://www.example.com' })).toEqual({});
  });
});

describe('normalizeHost', () => {
  it('lower-cases and keeps a non-default port', () => {
    expect(normalizeHost('Dashboard.Example.COM')).toBe('dashboard.example.com');
    expect(normalizeHost('localhost:4000')).toBe('localhost:4000');
    expect(normalizeHost('www.example.com:443')).toBe('www.example.com');
    expect(normalizeHost('www.example.com:80')).toBe('www.example.com');
    expect(normalizeHost(null)).toBe('');
    expect(normalizeHost('a.example.com, b.example.com')).toBe('a.example.com'); // x-forwarded-host with several proxies
  });
});

describe('routeFor: dashboard host', () => {
  const d = (path: string, search = '') => routeFor('dashboard.example.com', path, split, search);
  it('"/" shows the dashboard, /dashboard/* is served as is', () => {
    expect(d('/')).toEqual({ action: 'rewrite', to: '/dashboard' });
    expect(d('/dashboard')).toEqual({ action: 'next' });
    expect(d('/dashboard/posts')).toEqual({ action: 'next' });
    expect(d('/dashboard/users')).toEqual({ action: 'next' });
  });
  it('public shop pages redirect to the public site (path and query kept)', () => {
    expect(d('/shop', '?q=bag')).toEqual({ action: 'redirect', to: 'https://www.example.com/shop?q=bag', status: 307 });
    expect(d('/products/lily-p1')).toEqual({ action: 'redirect', to: 'https://www.example.com/products/lily-p1', status: 307 });
    expect(d('/workshops')).toEqual({ action: 'redirect', to: 'https://www.example.com/workshops', status: 307 });
  });
  it('legacy /admin links move to /dashboard on the same host', () => {
    expect(d('/admin')).toEqual({ action: 'redirect', to: 'https://dashboard.example.com/dashboard', status: 308 });
    expect(d('/admin/posts', '?x=1')).toEqual({ action: 'redirect', to: 'https://dashboard.example.com/dashboard/posts?x=1', status: 308 });
  });
  it('the API, auth endpoints, framework files and robots work on this host', () => {
    for (const p of ['/api/products', '/api/auth/session', '/_next/static/x.js', '/_next/image', '/favicon.ico', '/icon', '/manifest.webmanifest', '/robots.txt'])
      expect(d(p)).toEqual({ action: 'next' });
  });
  it('look-alike paths are not treated as dashboard paths', () => {
    expect(d('/dashboardx').action).toBe('redirect');
    expect(d('/dashboard-evil/x').action).toBe('redirect');
    expect(d('/apiary').action).toBe('redirect');
  });
  it('host matching ignores case and default ports', () => {
    expect(routeFor('DASHBOARD.example.com:443', '/', split)).toEqual({ action: 'rewrite', to: '/dashboard' });
  });
});

describe('routeFor: public host', () => {
  const p = (path: string, search = '') => routeFor('www.example.com', path, split, search);
  it('shop pages and the API are served', () => {
    for (const path of ['/', '/shop', '/workshops', '/products/x-p1', '/cities/jaipur', '/api/products', '/api/health']) expect(p(path)).toEqual({ action: 'next' });
  });
  it('the dashboard does not exist on the public host (404), including look-alikes under it', () => {
    expect(p('/dashboard')).toEqual({ action: 'notfound' });
    expect(p('/dashboard/posts')).toEqual({ action: 'notfound' });
    expect(p('/dashboard/users/anything')).toEqual({ action: 'notfound' });
  });
  it('old /admin bookmarks are sent to the dashboard host', () => {
    expect(p('/admin')).toEqual({ action: 'redirect', to: 'https://dashboard.example.com/dashboard', status: 308 });
    expect(p('/admin/posts', '?a=1')).toEqual({ action: 'redirect', to: 'https://dashboard.example.com/dashboard/posts?a=1', status: 308 });
  });
  it('any other host (an IP address, a typo domain) is treated like the public host', () => {
    expect(routeFor('65.1.95.223:3000', '/dashboard/posts', split)).toEqual({ action: 'notfound' });
    expect(routeFor('65.1.95.223:3000', '/shop', split)).toEqual({ action: 'next' });
  });
});

describe('routeFor: single-host mode (local development)', () => {
  it('everything is served on one host; /admin moves to /dashboard', () => {
    expect(routeFor('localhost:3001', '/', single)).toEqual({ action: 'next' });
    expect(routeFor('localhost:3001', '/dashboard/posts', single)).toEqual({ action: 'next' });
    expect(routeFor('localhost:3001', '/shop', single)).toEqual({ action: 'next' });
    expect(routeFor('localhost:3001', '/admin/posts', single, '?z=1')).toEqual({ action: 'redirect', to: '/dashboard/posts?z=1', status: 308 });
    expect(routeFor('localhost:3001', '/admin', single)).toEqual({ action: 'redirect', to: '/dashboard', status: 308 });
  });
});

describe('signInUrl', () => {
  it('single host: a relative sign-in URL with the dashboard page as callback', () => {
    expect(signInUrl('/dashboard/posts', single)).toBe('/api/auth/signin?callbackUrl=%2Fdashboard%2Fposts');
  });
  it('two hosts: sign-in always starts on the public host and returns to the dashboard host', () => {
    expect(signInUrl('/dashboard/posts', split)).toBe('https://www.example.com/api/auth/signin?callbackUrl=' + encodeURIComponent('https://dashboard.example.com/dashboard/posts'));
  });
});
