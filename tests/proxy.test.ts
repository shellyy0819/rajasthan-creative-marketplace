import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config } from '@/proxy';

const env = { DASHBOARD_URL: process.env.DASHBOARD_URL, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL };
afterEach(() => { for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
const split = () => { process.env.DASHBOARD_URL = 'https://dashboard.example.com'; process.env.NEXT_PUBLIC_SITE_URL = 'https://www.example.com'; };
const req = (host: string, path: string, headers: Record<string, string> = {}) => new NextRequest(`http://internal:3000${path}`, { headers: { host, ...headers } });

describe('proxy', () => {
  it('dashboard host: "/" is rewritten to /dashboard (URL unchanged), /dashboard passes through', () => {
    split();
    const r = proxy(req('dashboard.example.com', '/'));
    expect(r.headers.get('x-middleware-rewrite')).toBe('http://internal:3000/dashboard');
    const ok = proxy(req('dashboard.example.com', '/dashboard/posts'));
    expect(ok.headers.get('x-middleware-next')).toBe('1');
    expect(ok.headers.get('x-middleware-rewrite')).toBeNull();
  });
  it('dashboard host: shop pages redirect to the public site with a 307 and the query string', () => {
    split();
    const r = proxy(req('dashboard.example.com', '/shop?q=bag'));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://www.example.com/shop?q=bag');
  });
  it('public host: /dashboard is a 404 (rewritten to a path that does not exist), legacy /admin goes to the dashboard host', () => {
    split();
    const nf = proxy(req('www.example.com', '/dashboard/posts'));
    expect(nf.headers.get('x-middleware-rewrite')).toContain('/_not-found-dashboard');
    const old = proxy(req('www.example.com', '/admin/posts'));
    expect(old.status).toBe(308);
    expect(old.headers.get('location')).toBe('https://dashboard.example.com/dashboard/posts');
  });
  it('uses x-forwarded-host when a reverse proxy sets it (first value wins)', () => {
    split();
    const r = proxy(req('app:3000', '/', { 'x-forwarded-host': 'dashboard.example.com' }));
    expect(r.headers.get('x-middleware-rewrite')).toBe('http://internal:3000/dashboard');
    const pub = proxy(req('app:3000', '/dashboard', { 'x-forwarded-host': 'www.example.com, 10.0.0.1' }));
    expect(pub.headers.get('x-middleware-rewrite')).toContain('/_not-found-dashboard');
  });
  it('/sell is served on the public host and redirected to the public host from the dashboard host', () => {
    split();
    expect(proxy(req('www.example.com', '/sell')).headers.get('x-middleware-next')).toBe('1');
    const r = proxy(req('dashboard.example.com', '/sell'));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://www.example.com/sell');
  });
  it('the API is served on both hosts (it does its own authorisation)', () => {
    split();
    for (const host of ['www.example.com', 'dashboard.example.com']) expect(proxy(req(host, '/api/products')).headers.get('x-middleware-next')).toBe('1');
  });
  it('single-host mode (no DASHBOARD_URL): only /admin is redirected, to /dashboard on the same host', () => {
    delete process.env.DASHBOARD_URL;
    const r = proxy(req('localhost:3001', '/admin/users'));
    expect(r.status).toBe(308);
    expect(new URL(r.headers.get('location')!).pathname).toBe('/dashboard/users');
    expect(proxy(req('localhost:3001', '/dashboard/users')).headers.get('x-middleware-next')).toBe('1');
  });
  it('does not run for framework assets', () => {
    expect(config.matcher[0]).toContain('_next/static');
  });
});
