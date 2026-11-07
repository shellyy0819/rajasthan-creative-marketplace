// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Breadcrumbs } from '@/components/Breadcrumbs';

afterEach(cleanup);

const pages = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? pages(path.join(dir, e.name)) : e.name === 'page.tsx' ? [path.join(dir, e.name)] : []);

describe('breadcrumbs on every inner page', () => {
  // The home page is the root, /dashboard only redirects to /dashboard/posts, and /coming-soon is a single-screen landing page.
  const exempt = new Set(['src/app/page.tsx', 'src/app/dashboard/page.tsx', 'src/app/coming-soon/page.tsx', 'src/app/seller-access/page.tsx']); // coming-soon is a standalone landing screen; seller-access only redirects to /sell
  it('every page except the exempt ones renders <Breadcrumbs>', () => {
    const missing = pages('src/app').filter(f => !exempt.has(f) && !fs.readFileSync(f, 'utf8').includes('<Breadcrumbs'));
    expect(missing).toEqual([]);
  });
  it('renders links for parents and the current page as plain text', () => {
    render(<Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Dashboard', path: '/dashboard' }, { name: 'Artists’ posts', path: '/dashboard/posts' }]} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/', '/dashboard']);
    expect(within(nav).getByText('Artists’ posts').getAttribute('aria-current')).toBe('page');
  });
});

describe('breadcrumb keys', () => {
  it('two crumbs with the same path do not trigger React\'s duplicate-key warning', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Seller', path: '/dashboard/posts' }, { name: 'My products', path: '/dashboard/posts' }]} />);
    expect(err.mock.calls.filter(c => String(c[0]).includes('same key'))).toEqual([]);
    err.mockRestore();
  });
});

