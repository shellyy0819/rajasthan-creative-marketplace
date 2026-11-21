// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
const nav = vi.hoisted(() => ({ path: '/workshops' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
import WorkshopsLoading from '@/app/workshops/loading';
import ShopLoading from '@/app/shop/loading';
import { readCss } from './helpers/css';

afterEach(cleanup);
const css = readCss();

describe('route loading state', () => {
  it('has no site-wide spinner: a page without its own loading state keeps the old page on screen until the new one is ready (source contract)', () => {
    expect(fs.existsSync('src/app/loading.tsx')).toBe(false);
  });
  it('the shop and the workshops page each have their own loading state with the static top of the page', () => {
    expect(fs.existsSync('src/app/shop/loading.tsx')).toBe(true);
    expect(fs.existsSync('src/app/workshops/loading.tsx')).toBe(true);
  });
  it('the list of workshops shows no spinner while a search loads: the old results are only dimmed (source contract)', () => {
    const src = fs.readFileSync('src/components/LiveCatalog.tsx', 'utf8');
    expect(src).not.toContain('PageLoader');
    expect(src).toContain("opacity: loading ? 0.6 : 1");
  });
});

describe('the workshops loading state', () => {
  it('shows the static top of the page at once: breadcrumbs, eyebrow, title, intro and the line about what can be listed', () => {
    render(<WorkshopsLoading />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Workshops');
    expect(screen.getByRole('heading', { level: 1, name: 'Creative workshops & pop-ups' })).toBeTruthy();
    expect(screen.getByText('OUT OF THE SCROLL, INTO THE STUDIO')).toBeTruthy();
    expect(screen.getByText(/Hands-on workshops, creative meetups and pop-ups hosted by local studios/)).toBeTruthy();
    expect(screen.getByText(/^You can list /)).toBeTruthy();
  });
  it('holds the button, the filters and four list rows as placeholders, with no spinner', () => {
    const { container } = render(<WorkshopsLoading />);
    expect(container.querySelector('.ws-head-cta .skeleton-button')).toBeTruthy();
    expect(container.querySelector('.skeleton-filters')).toBeTruthy();
    expect(container.querySelectorAll('.workshop-list .skeleton-workshop')).toHaveLength(4);
    expect(container.querySelector('.rr-page-loader')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Loading workshops');
  });
  it('matches the real page: the same heading structure and copy as app/workshops/page.tsx (source contract)', () => {
    const page = fs.readFileSync('src/app/workshops/page.tsx', 'utf8');
    const loading = fs.readFileSync('src/app/workshops/loading.tsx', 'utf8');
    for (const marker of ['<div className="page-head ws-head">', 'OUT OF THE SCROLL, INTO THE STUDIO', '<h1>Creative workshops &amp; pop-ups</h1>', 'Hands-on workshops, creative meetups and pop-ups hosted by local studios and cafés.', '<p className="ws-supports">{supportLine()}</p>']) {
      expect(page).toContain(marker);
      expect(loading).toContain(marker);
    }
  });
  it('the placeholders have sizes in the stylesheet', () => {
    expect(css).toMatch(/\.skeleton-button\s*\{[^}]*height:\s*44px/);
    expect(css).toMatch(/\.skeleton-workshop\s*\{[^}]*height:\s*120px/);
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
