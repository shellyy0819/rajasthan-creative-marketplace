// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const session = vi.hoisted(() => ({ value: { data: null as any, status: 'unauthenticated' } }));
const signIn = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ useSession: () => session.value, signIn, signOut: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { AuthButton } from '@/components/AuthButton';

beforeEach(() => { signIn.mockClear(); session.value = { data: null, status: 'unauthenticated' }; });
afterEach(cleanup);

describe('AuthButton signed out', () => {
  it('shows the seller prompt and the Seller login button', () => {
    render(<AuthButton />);
    expect(screen.getByText(/Are you a seller\?/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Login here' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seller login' })).toBeTruthy();
  });
  it('click calls signIn with callbackUrl /sell', () => {
    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Login here' }));
    expect(signIn).toHaveBeenLastCalledWith('google', { callbackUrl: '/sell' });
    fireEvent.click(screen.getByRole('button', { name: 'Seller login' }));
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(signIn).toHaveBeenLastCalledWith('google', { callbackUrl: '/sell' });
  });
  it('keeps the loading placeholder hidden', () => {
    session.value = { data: null, status: 'loading' };
    render(<AuthButton />);
    expect(screen.queryByText(/Are you a seller/)).toBeNull();
  });
});

describe('AuthButton signed in', () => {
  it('admin and seller rendering unchanged', () => {
    session.value = { data: { user: { email: 'a@x.co', role: 'admin' } }, status: 'authenticated' };
    const { unmount } = render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/dashboard/posts');
    expect(screen.getByRole('button', { name: 'Sign out (admin)' })).toBeTruthy();
    expect(screen.queryByText(/Are you a seller/)).toBeNull();
    unmount();
    session.value = { data: { user: { email: 's@x.co', name: 'Meera Sharma', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'My products' }).getAttribute('href')).toBe('/dashboard/posts');
    expect(screen.getByRole('button', { name: 'Sign out (Meera Sharma)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Seller login' })).toBeNull();
  });
  it('My products and Admin links use the dashboard origin when split-host', () => {
    session.value = { data: { user: { email: 's@x.co', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton dashboardUrl="https://dashboard.example.com" />);
    expect(screen.getByRole('link', { name: 'My products' }).getAttribute('href')).toBe('https://dashboard.example.com/dashboard/posts');
  });
});

describe('entry points (source contract)', () => {
  it('Header passes the dashboard origin to AuthButton', () => {
    expect(fs.readFileSync('src/components/Header.tsx', 'utf8')).toContain("dashboardUrl={hostConfig().dashboardOrigin ?? ''}");
  });
  it('home page links to /sell and no longer renders ListingRequestButton', () => {
    const home = fs.readFileSync('src/app/page.tsx', 'utf8');
    expect(home).toMatch(/href="\/sell"/);
    expect(home).not.toContain('ListingRequestButton');
  });
  it('footer Seller login link still present', () => {
    expect(fs.readFileSync('src/components/Footer.tsx', 'utf8')).toMatch(/href="\/sell"[^>]*>Seller login/);
  });
});
