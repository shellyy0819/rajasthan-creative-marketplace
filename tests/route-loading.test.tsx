// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
const nav = vi.hoisted(() => ({ path: '/workshops' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
import Loading from '@/app/loading';
import ShopLoading from '@/app/shop/loading';
import { readCss } from './helpers/css';

afterEach(cleanup);
const css = readCss();

describe('route loading state', () => {
  it('shows nothing on the shop, where the product grid fills in on its own', () => {
    nav.path = '/shop';
    const { container } = render(<Loading />);
    expect(container.innerHTML).toBe('');
    nav.path = '/workshops';
  });
  it('shows a status spinner while a page streams in, without blocking clicks', () => {
    render(<Loading />);
    const s = screen.getByRole('status');
    expect(s.textContent).toContain('Loading');
    expect(s.className).not.toContain('blocking');
  });
});

describe('loader never covers the navbar', () => {
  it('the overlay starts below the navbar height, on desktop and mobile', () => {
    expect(css).toMatch(/\.rr-page-loader\{[^}]*top:var\(--topbar-h\)/);
    expect(css).toMatch(/:root\{--banner-h:38px;--topbar-h:116px\}/);
    expect(css).toMatch(/@media\(max-width:600px\)\{:root\{--topbar-h:105px\}\}/);
  });
  it('main keeps at least the visible height under the navbar, so the footer does not jump while a page loads', () => {
    expect(css).toMatch(/(^|[\s}])main\{[^}]*min-height:calc\(100svh - var\(--topbar-h\)\)/);
  });
});

describe('the shop loading state', () => {
  it('shows the static top of the page at once: breadcrumbs, eyebrow, title and intro', () => {
    render(<ShopLoading />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Shop');
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeTruthy();
    expect(screen.getByText("THE MAKERS' SHELF")).toBeTruthy();
    expect(screen.getByText(/online marketplace for products from independent artisans/)).toBeTruthy();
  });
  it('holds the filters and the grid as placeholders, and says it is loading to screen readers', () => {
    const { container } = render(<ShopLoading />);
    expect(screen.getByRole('status').textContent).toBe('Loading products');
    expect(container.querySelectorAll('.product-grid .skeleton-card')).toHaveLength(8);
    expect(container.querySelector('.skeleton-filters')).toBeTruthy();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
  it('matches the real page: the same heading structure and classes as app/shop/page.tsx (source contract)', () => {
    const page = fs.readFileSync('src/app/shop/page.tsx', 'utf8');
    const loading = fs.readFileSync('src/app/shop/loading.tsx', 'utf8');
    for (const marker of ['<div className="page-head">', '<span className="eyebrow">THE MAKERS&apos; SHELF</span>', 'Craftofy is an online marketplace for', 'Craftofy charges makers no commission.']) {
      expect(page).toContain(marker);
      expect(loading).toContain(marker);
    }
  });
  it('the placeholder filter bar has a size in the stylesheet', () => {
    expect(css).toMatch(/\.skeleton-filters\s*\{[^}]*height:\s*44px/);
  });
});
