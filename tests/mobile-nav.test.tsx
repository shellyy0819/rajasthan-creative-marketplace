// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const session = vi.hoisted(() => ({ value: { data: null as any, status: 'unauthenticated' } }));
const path = vi.hoisted(() => ({ value: '/' }));
vi.mock('next-auth/react', () => ({ useSession: () => session.value }));
vi.mock('next/navigation', () => ({ usePathname: () => path.value }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { MobileNav } from '@/components/MobileNav';

beforeEach(() => {
  session.value = { data: null, status: 'unauthenticated' }; path.value = '/';
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.style.overflow = ''; });

const openIt = () => fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
const links = () => within().map(a => `${a.textContent}|${a.getAttribute('href')}`);
const within = () => [...document.querySelectorAll('.mobile-drawer-nav a')] as HTMLAnchorElement[];

describe('the phone menu', () => {
  it('is closed until the hamburger is pressed, then shows a left drawer with the main links', () => {
    render(<MobileNav />);
    const btn = screen.getByRole('button', { name: 'Open menu' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
    openIt();
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(links()).toEqual(['Shop products|/shop', 'Workshops & pop-ups|/workshops']);
  });
  it('the drawer is drawn on the page body, outside the header (whose blur would trap a fixed panel)', () => {
    const { container } = render(<MobileNav />);
    openIt();
    expect(container.querySelector('.mobile-drawer')).toBeNull();
    expect(document.body.querySelector(':scope > .mobile-drawer')).toBeTruthy();
  });
  it('adds Admin for an admin and My products for a seller, pointing at the dashboard host', () => {
    session.value = { data: { user: { role: 'admin' } }, status: 'authenticated' };
    render(<MobileNav dashboardUrl="https://dash.craftofy.online" />);
    openIt();
    expect(links()).toContain('Admin|https://dash.craftofy.online/dashboard/posts');
    cleanup();
    session.value = { data: { user: { role: 'seller' } }, status: 'authenticated' };
    render(<MobileNav />);
    openIt();
    expect(links()).toContain('My products|/dashboard/posts');
    expect(links().some(l => l.startsWith('Admin'))).toBe(false);
  });
  it('carries the Fair link only while the fair is open', () => {
    render(<MobileNav fair />);
    openIt();
    expect(links()).toContain('Fair|/fair');
    cleanup();
    render(<MobileNav />);
    openIt();
    expect(links().some(l => l.startsWith('Fair'))).toBe(false);
  });
  it('a customer or a signed-out visitor sees neither', () => {
    session.value = { data: { user: { role: 'customer' } }, status: 'authenticated' };
    render(<MobileNav />);
    openIt();
    expect(links()).toHaveLength(2);
  });
  it('closes on Escape, the close button, the backdrop and a link, and gives focus back to the hamburger', () => {
    render(<MobileNav />);
    const btn = screen.getByRole('button', { name: 'Open menu' });
    openIt();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(btn);
    openIt(); fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    openIt(); fireEvent.click(document.querySelector('.mobile-drawer-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    openIt(); fireEvent.click(within()[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('moves focus into the drawer, keeps Tab inside it, and stops the page behind from scrolling while open', () => {
    render(<MobileNav />);
    openIt();
    const items = [...document.querySelectorAll<HTMLElement>('.mobile-drawer a, .mobile-drawer button')];
    expect(document.activeElement).toBe(items[0]);
    items[items.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(items[0]);
    items[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });
  it('closes when the page changes', () => {
    const { rerender } = render(<MobileNav />);
    openIt();
    path.value = '/shop';
    rerender(<MobileNav />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the logo at the top of the phone menu', () => {
  it('shows the Craftofy logo (light and dark versions) as a link home, in place of a text title', () => {
    render(<MobileNav />);
    openIt();
    const head = document.querySelector('.mobile-drawer-head')!;
    const home = head.querySelector('a[aria-label="Craftofy home"]')!;
    expect(home.getAttribute('href')).toBe('/');
    expect(home.querySelector('img.logo-light')?.getAttribute('src')).toBe('/logos/horizontal-color.png');
    expect(home.querySelector('img.logo-dark')?.getAttribute('src')).toBe('/logos/horizontal-dark.png');
    expect(head.textContent).not.toMatch(/menu/i);
  });
  it('tapping it closes the menu, including when the visitor is already on the home page', () => {
    path.value = '/';
    render(<MobileNav />);
    openIt();
    fireEvent.click(document.querySelector('.mobile-drawer-head a[aria-label="Craftofy home"]')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('the dialog is still named Menu for screen readers', () => {
    render(<MobileNav />);
    openIt();
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
  });
});

describe('the active page in the phone menu', () => {
  const current = () => [...document.querySelectorAll('.mobile-drawer-nav a[aria-current="page"]')].map(a => a.textContent);
  it('marks no link on a page that is not in the menu (the home page)', () => {
    path.value = '/';
    render(<MobileNav />);
    openIt();
    expect(current()).toEqual([]);
  });
  it('marks Shop products on /shop and Workshops on /workshops and the pages under it, never both', () => {
    path.value = '/shop';
    render(<MobileNav />); openIt();
    expect(current()).toEqual(['Shop products']);
    cleanup();
    path.value = '/workshops/yoga-w4';
    render(<MobileNav />); openIt();
    expect(current()).toEqual(['Workshops & pop-ups']);
    cleanup();
    path.value = '/workshopsX';
    render(<MobileNav />); openIt();
    expect(current()).toEqual([]); // a path that only starts with the same letters is not that page
  });
  it('marks Admin or My products on every dashboard page, and Fair on /fair', () => {
    session.value = { data: { user: { role: 'admin' } }, status: 'authenticated' };
    path.value = '/dashboard/trending';
    render(<MobileNav fair />); openIt();
    expect(current()).toEqual(['Admin']);
    cleanup();
    session.value = { data: { user: { role: 'seller' } }, status: 'authenticated' };
    path.value = '/dashboard/workshops/w3/bookings';
    render(<MobileNav />); openIt();
    expect(current()).toEqual(['My products']);
    cleanup();
    session.value = { data: null, status: 'unauthenticated' };
    path.value = '/fair';
    render(<MobileNav fair />); openIt();
    expect(current()).toEqual(['Fair']);
  });
  it('the highlight is the site\'s selected-chip tint with dark green text, from tokens only (source contract)', () => {
    const css = fs.readFileSync('src/components/MobileNav.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.mobile-drawer-nav a\[aria-current='page'\] \{ background: var\(--chip-green\); color: var\(--green-d\); font-weight: 700; \}/);
  });
});

describe('the phone menu styling (source contract)', () => {
  const css = fs.readFileSync('src/components/MobileNav.css', 'utf8').replace(/\s+/g, ' ');
  it('the hamburger only exists on phones, as the same 36px round control as the theme button', () => {
    expect(css).toMatch(/\.mobile-nav-btn \{ display: none; \}/);
    expect(css).toMatch(/@media \(max-width: 600px\) \{ \.mobile-nav-btn \{ display: grid;/);
    expect(fs.readFileSync('src/components/MobileNav.tsx', 'utf8')).toContain('className="theme-toggle mobile-nav-btn"');
  });
  it('the links keep the top bar\'s size and weight (12px, 600) and use theme tokens only', () => {
    expect(css).toMatch(/nav\.mobile-drawer-nav \{[^}]*font-size: 12px; font-weight: 600;/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
  it('the Fair pill leaves the bar for the drawer only below 430px, so it is never shown twice', () => {
    expect(css).toMatch(/\.mobile-drawer-nav a\.mobile-drawer-fair \{ display: none;/);
    expect(css).toMatch(/@media \(max-width: 430px\) \{ \.topbar nav > a\.nav-fair \{ display: none; \} \.mobile-drawer-nav a\.mobile-drawer-fair \{ display: flex; \}/);
  });
  it('slides in from the left over the shared modal backdrop, above the sticky header', () => {
    expect(css).toMatch(/\.mobile-drawer \{[^}]*left: 0;[^}]*z-index: 71;[^}]*width: min\(82vw, 300px\)/);
    expect(css).toContain('background: var(--backdrop)');
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.mobile-drawer \{ animation: none; \}/);
  });
});
