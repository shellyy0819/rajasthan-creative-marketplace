// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

describe('robots', () => {
  it('disallows /admin/ and /api/', () => {
    const rules = robots().rules as { disallow: string[] }[];
    expect(rules[0].disallow).toEqual(expect.arrayContaining(['/api/', '/admin/']));
  });
});

describe('AuthButton seller link', () => {
  it('shows My products (not Admin) for sellers and labels the sign-out button', () => {
    session.value = { data: { user: { email: 's@x.co', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'My products' }).getAttribute('href')).toBe('/admin/posts');
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(screen.getByRole('button', { name: /Sign out \(seller\)/ })).toBeTruthy();
  });
});

describe('AuthButton admin link', () => {
  it('shows an Admin link only for admins', () => {
    session.value = { data: { user: { email: 'a@x.co', role: 'admin' } }, status: 'authenticated' };
    const { unmount } = render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin/posts');
    unmount();
    session.value = { data: { user: { email: 'c@x.co', role: 'customer' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });
});
