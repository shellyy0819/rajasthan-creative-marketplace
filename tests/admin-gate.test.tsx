// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { adminGate } from '@/lib/admin-gate';
import robots from '@/app/robots';

const session = vi.hoisted(() => ({ value: { data: null as any, status: 'unauthenticated' } }));
vi.mock('next-auth/react', () => ({ useSession: () => session.value, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { AuthButton } from '@/components/AuthButton';

afterEach(cleanup);

describe('adminGate', () => {
  it('signin for anonymous or email-less sessions', () => {
    expect(adminGate(null)).toBe('signin');
    expect(adminGate({ user: {} })).toBe('signin');
  });
  it('forbidden for customers and role-less users; ok for admins', () => {
    expect(adminGate({ user: { email: 'c@x.co', role: 'customer' } })).toBe('forbidden');
    expect(adminGate({ user: { email: 'c@x.co' } })).toBe('forbidden');
    expect(adminGate({ user: { email: 'a@x.co', role: 'admin' } })).toBe('ok');
  });
});

const hdrs = vi.hoisted(() => ({ host: 'www.example.com' as string | null }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: (k: string) => (k === 'host' ? hdrs.host : null) }) }));

describe('robots', () => {
  const env = { DASHBOARD_URL: process.env.DASHBOARD_URL, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL };
  afterEach(() => { for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  it('public site: disallows /dashboard/, /admin/ and /api/ and lists the sitemap', async () => {
    delete process.env.DASHBOARD_URL; hdrs.host = 'localhost:3000';
    const r = await robots();
    const rules = r.rules as { disallow: string[] }[];
    expect(rules[0].disallow).toEqual(expect.arrayContaining(['/api/', '/dashboard/', '/admin/']));
    expect(r.sitemap).toBeTruthy();
  });
  it('dashboard host: disallows everything and has no sitemap', async () => {
    process.env.DASHBOARD_URL = 'https://dashboard.example.com'; process.env.NEXT_PUBLIC_SITE_URL = 'https://www.example.com';
    hdrs.host = 'dashboard.example.com';
    const r = await robots();
    expect((r.rules as { disallow: string }[])[0].disallow).toBe('/');
    expect(r.sitemap).toBeUndefined();
    hdrs.host = 'www.example.com';
    expect(((await robots()).rules as { disallow: string[] }[])[0].disallow).toEqual(expect.arrayContaining(['/dashboard/']));
  });
});

describe('AuthButton seller link', () => {
  it('shows My products (not Admin) for sellers', () => {
    session.value = { data: { user: { email: 's@x.co', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'My products' }).getAttribute('href')).toBe('/dashboard/posts');
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull(); // sign out now lives in the account menu
  });
});

describe('AuthButton with a separate dashboard host', () => {
  it('links to the dashboard host (the dashboard does not exist on the public host)', () => {
    session.value = { data: { user: { email: 'a@x.co', role: 'admin' } }, status: 'authenticated' };
    render(<AuthButton dashboardUrl="https://dashboard.example.com" />);
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('https://dashboard.example.com/dashboard/posts');
  });
});

describe('AuthButton admin link', () => {
  it('shows an Admin link only for admins', () => {
    session.value = { data: { user: { email: 'a@x.co', role: 'admin' } }, status: 'authenticated' };
    const { unmount } = render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/dashboard/posts');
    unmount();
    session.value = { data: { user: { email: 'c@x.co', role: 'customer' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });
});
