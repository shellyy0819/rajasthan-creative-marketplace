// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const session = vi.hoisted(() => ({ value: { data: null as any, status: 'unauthenticated' } }));
const signIn = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ useSession: () => session.value, signIn, signOut: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { AuthButton } from '@/components/AuthButton';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ userId: 'u', displayName: 'D' }) }))); signIn.mockClear(); session.value = { data: null, status: 'unauthenticated' }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('AuthButton signed out', () => {
  it('shows the seller prompt (desktop link) and the mobile button, both labelled Login here', () => {
    render(<AuthButton />);
    expect(screen.getByText(/Are you a seller\?/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Login here' })).toHaveLength(2);
  });
  it('click calls signIn with callbackUrl /sell', () => {
    render(<AuthButton />);
    const [link, mobileBtn] = screen.getAllByRole('button', { name: 'Login here' });
    fireEvent.click(link);
    expect(signIn).toHaveBeenLastCalledWith('google', { callbackUrl: '/sell' });
    fireEvent.click(mobileBtn);
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
  const menu = () => fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  it('admin and seller keep their nav link; the old Sign out button is gone', () => {
    session.value = { data: { user: { email: 'a@x.co', role: 'admin' } }, status: 'authenticated' };
    const { unmount } = render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/dashboard/posts');
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull();
    expect(screen.queryByText(/Are you a seller/)).toBeNull();
    unmount();
    session.value = { data: { user: { email: 's@x.co', name: 'Meera Sharma', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.getByRole('link', { name: 'My products' }).getAttribute('href')).toBe('/dashboard/posts');
    expect(screen.queryByRole('button', { name: 'Login here' })).toBeNull();
  });
  it('the avatar opens a menu with My profile first and Logout below it; closed until clicked', () => {
    session.value = { data: { user: { email: 's@x.co', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton />);
    expect(screen.queryByRole('menu')).toBeNull();
    menu();
    expect(screen.getByRole('button', { name: 'Account menu' }).getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem');
    expect(items.map(i => i.textContent)).toEqual(['My profile', 'Logout']);
    expect(items[0].getAttribute('href')).toBe('/dashboard/posts?profile=1');
  });
  it('My profile uses the dashboard origin when split-host; Logout signs out', async () => {
    const { signOut } = await import('next-auth/react');
    session.value = { data: { user: { email: 's@x.co', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton dashboardUrl="https://dashboard.example.com" />);
    menu();
    expect(screen.getByRole('menuitem', { name: 'My profile' }).getAttribute('href')).toBe('https://dashboard.example.com/dashboard/posts?profile=1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Logout' }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/?signedout=1' });
  });
  it('shows the brand logo in the avatar, the default icon without one, and the default when the logo fails to load', async () => {
    session.value = { data: { user: { email: 's@x.co', role: 'seller' } }, status: 'authenticated' };
    const { unmount } = render(<AuthButton />);
    expect(document.querySelector('.avatar-default')).toBeTruthy();
    expect(document.querySelector('.avatar-img')).toBeNull();
    unmount();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ userId: 'u', displayName: 'D', logoUrl: 'https://cdn.example.com/l.png' }) })));
    render(<AuthButton />);
    await waitFor(() => expect((document.querySelector('.avatar-img') as HTMLImageElement).src).toBe('https://cdn.example.com/l.png'));
    fireEvent.error(document.querySelector('.avatar-img')!);
    expect(document.querySelector('.avatar-default')).toBeTruthy();
  });
  it('Escape and an outside click close the menu', () => {
    session.value = { data: { user: { email: 's@x.co', role: 'seller' } }, status: 'authenticated' };
    render(<AuthButton />);
    menu(); fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    menu(); fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('a signed-in customer gets Logout only', () => {
    session.value = { data: { user: { email: 'c@x.co' } }, status: 'authenticated' };
    render(<AuthButton />);
    menu();
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Logout']);
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
