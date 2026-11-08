// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Children, type ReactElement, type ReactNode } from 'react';

const signIn = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ signIn }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const nav = vi.hoisted(() => ({ redirect: vi.fn((to: string) => { throw new Error('REDIRECT:' + to); }), notFound: vi.fn() }));
vi.mock('next/navigation', () => nav);
import { SignInCard } from '@/components/SignInCard';
import SignInPage, { metadata } from '@/app/signin/page';
import { Breadcrumbs } from '@/components/Breadcrumbs';

beforeEach(() => { signIn.mockReset(); signIn.mockReturnValue(new Promise(() => {})); authMock.mockReset(); delete process.env.DASHBOARD_URL; });
afterEach(cleanup);

describe('sign-in card', () => {
  it('shows the approved copy and the Google button', () => {
    render(<SignInCard callbackUrl="/sell" />);
    expect(screen.getByText('FOR MAKERS')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Craftofy' })).toBeTruthy();
    expect(screen.getByText('Use your Google account to add products and manage your listings. New here? Signing in sets up your seller profile in about three minutes.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.getByText('We use Google only to confirm your name and email. We never post anything.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the shop' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('click starts Google sign-in with the callback and no account chooser', () => {
    render(<SignInCard callbackUrl="/dashboard/posts" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/dashboard/posts' });
  });
  it('pending: disabled, aria-busy, new label, and a second tap does not start a second sign-in', () => {
    render(<SignInCard callbackUrl="/sell" />);
    const btn = screen.getByRole('button', { name: 'Continue with Google' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    const busy = screen.getByRole('button', { name: 'Taking you to Google…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(busy);
    expect(signIn).toHaveBeenCalledTimes(1);
  });
  it('a failed start re-enables the button and shows the generic message', async () => {
    signIn.mockReset(); signIn.mockRejectedValue(new Error('network'));
    render(<SignInCard callbackUrl="/sell" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect((await screen.findByRole('alert')).textContent).toContain('We could not sign you in. Check your connection and try again.');
    expect((screen.getByRole('button', { name: 'Try again with Google' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('AccessDenied: one combined alert, no raw code, button offers another account and asks Google to choose', () => {
    render(<SignInCard callbackUrl="/sell" error="AccessDenied" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('We could not sign you in with this account. It may be deactivated, or its Google email may not be verified. Contact Craftofy if you think this is a mistake.');
    expect(document.body.textContent).not.toContain('AccessDenied');
    fireEvent.click(screen.getByRole('button', { name: 'Use a different Google account' }));
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/sell' }, { prompt: 'select_account' });
  });
  it('any other error: generic alert, never the raw code, Try again with Google', () => {
    render(<SignInCard callbackUrl="/sell" error="OAuthCallback" />);
    expect(screen.getByRole('alert').textContent).toBe('We could not sign you in. Check your connection and try again.');
    expect(document.body.textContent).not.toContain('OAuthCallback');
    fireEvent.click(screen.getByRole('button', { name: 'Try again with Google' }));
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/sell' }, { prompt: 'select_account' });
  });
});

describe('/signin page', () => {
  const sp = (o: Record<string, string>) => Promise.resolve(o);
  const card = async (o: Record<string, string>) => {
    const el = (await SignInPage({ searchParams: sp(o) })) as ReactElement;
    const kids = Children.toArray((el.props as { children?: ReactNode }).children) as ReactElement[];
    expect(kids[0].type).toBe(Breadcrumbs);
    return kids[1].props as { callbackUrl: string; error?: string };
  };
  it('is noindex and titled Sign in', () => {
    expect(metadata.title).toBe('Sign in');
    expect(metadata.robots).toMatchObject({ index: false });
  });
  it('signed out: passes a safe callback through, defaults to /sell, and forwards the error', async () => {
    authMock.mockResolvedValue(null);
    expect(await card({ callbackUrl: '/dashboard/posts', error: 'AccessDenied' })).toEqual({ callbackUrl: '/dashboard/posts', error: 'AccessDenied' });
    expect((await card({})).callbackUrl).toBe('/sell');
    for (const bad of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '/\\evil.example', '\\\\evil.example'])
      expect((await card({ callbackUrl: bad })).callbackUrl, bad).toBe('/sell');
  });
  it('the dashboard origin is an allowed callback in split-host mode', async () => {
    process.env.DASHBOARD_URL = 'https://dashboard.example.com'; process.env.NEXT_PUBLIC_SITE_URL = 'https://www.example.com';
    authMock.mockResolvedValue(null);
    expect((await card({ callbackUrl: 'https://dashboard.example.com/dashboard/posts' })).callbackUrl).toBe('https://dashboard.example.com/dashboard/posts');
    expect((await card({ callbackUrl: 'https://dashboard.example.com.evil.org/x' })).callbackUrl).toBe('/sell');
  });
  it('signed-in seller or admin goes to the dashboard, or to a safe callback', async () => {
    for (const role of ['seller', 'admin']) {
      authMock.mockResolvedValue({ user: { email: 'a@x.co', role, active: true } });
      await expect(SignInPage({ searchParams: sp({}) })).rejects.toThrow('REDIRECT:/dashboard/posts');
      await expect(SignInPage({ searchParams: sp({ callbackUrl: '/dashboard/users' }) })).rejects.toThrow('REDIRECT:/dashboard/users');
      await expect(SignInPage({ searchParams: sp({ callbackUrl: 'https://evil.example' }) })).rejects.toThrow('REDIRECT:/dashboard/posts');
    }
  });
  it('signed-in roleless user goes to /sell', async () => {
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer', active: true } });
    await expect(SignInPage({ searchParams: sp({ callbackUrl: '/dashboard/posts' }) })).rejects.toThrow('REDIRECT:/sell');
  });
});
