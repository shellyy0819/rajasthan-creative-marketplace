// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { shellOnly } from './helpers/resolve-async';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
// The data never arrives: the page function must still return its shell.
const never = vi.hoisted(() => () => new Promise<never>(() => {}));
const gate = vi.hoisted(() => ({ any: true }));
vi.mock('@/lib/catalog', () => ({ listProducts: never, listWorkshops: never, hasAnyWorkshop: async () => gate.any }));
const auth = vi.hoisted(() => ({ deny: false }));
vi.mock('@/lib/admin-page', () => ({
  requireAdminPage: async () => { if (auth.deny) throw new Error('REDIRECT'); },
  requireStaffPage: async () => { if (auth.deny) throw new Error('REDIRECT'); return { id: 'u1', email: 'a@x.invalid', role: 'admin' }; },
}));
vi.mock('@/auth', () => ({ auth: async () => ({ user: { email: 'a@x.invalid' } }) }));
vi.mock('@/lib/listing-requests', () => ({ listListingRequests: never }));
vi.mock('@/lib/users', () => ({ listUsers: never, getProfileByEmail: never }));
vi.mock('@/lib/admin-posts', () => ({ scopeFor: () => ({}), listArtists: never, listProductsForAdmin: never, listSellerOptions: never, listWorkshopOptions: never }));
vi.mock('@/lib/hosts', () => ({ hostConfig: () => ({}) }));
vi.mock('@/components/PostsAdmin', () => ({ PostsAdmin: () => null }));
vi.mock('@/components/UsersAdmin', () => ({ UsersAdmin: () => null }));
vi.mock('@/components/ListingRequestsAdmin', () => ({ ListingRequestsAdmin: () => null }));
vi.mock('@/lib/categories', () => ({ listCategories: never }));
vi.mock('@/lib/cities', () => ({ listActiveCities: never }));
vi.mock('@/lib/trending', () => ({ trending: never }));

afterEach(() => { cleanup(); auth.deny = false; gate.any = true; });
const sp = Promise.resolve({});

describe('/shop streams: headings first, loader where the data goes', () => {
  it('returns without waiting for products, categories or cities', async () => {
    const Shop = (await import('@/app/shop/page')).default;
    const el = await Promise.race([Shop({ searchParams: sp }), new Promise(r => setTimeout(() => r('TIMEOUT'), 500))]);
    expect(el).not.toBe('TIMEOUT');
  });
  it('shows breadcrumbs, eyebrow, h1 and the intro at once, with the loader under the intro', async () => {
    const Shop = (await import('@/app/shop/page')).default;
    const { container } = render(shellOnly(await Shop({ searchParams: sp })) as React.ReactElement);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Handmade products');
    const intro = screen.getByText(/Handmade finds from independent makers/);
    const loader = screen.getByRole('status');
    expect(document.querySelector('.rr-section-loader')!.getAttribute('aria-busy')).toBe('true');
    expect(intro.compareDocumentPosition(loader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.rr-page-loader')).toBeNull();
    expect(container.querySelector('.product-grid .sk-card')).toBeTruthy();
  });
  it('wraps the catalog in a Suspense whose fallback is the SectionLoader', async () => {
    const Shop = (await import('@/app/shop/page')).default;
    const { SectionLoader } = await import('@/components/SectionLoader');
    const suspenses: React.ReactElement<any>[] = [];
    const walk = (n: React.ReactNode): void => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!React.isValidElement<any>(n)) return;
      if (n.type === React.Suspense) suspenses.push(n);
      walk((n.props as { children?: React.ReactNode }).children);
    };
    walk(await Shop({ searchParams: sp }));
    expect(suspenses).toHaveLength(1);
    expect(suspenses[0].props.fallback.type).toBe(SectionLoader);
  });
});

describe('/trending streams too', () => {
  it('shows its heading and a loader without waiting for the trending list', async () => {
    const Page = (await import('@/app/trending/page')).default;
    render(shellOnly(await Page()) as React.ReactElement);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trending handmade finds');
    expect(document.querySelector('.rr-section-loader')!.getAttribute('aria-busy')).toBe('true');
  });
});

describe('/workshops chooses its page before streaming', () => {
  it('with workshops scheduled: head and list loader (with filter placeholder) immediately, h1 is the catalog heading', async () => {
    const Page = (await import('@/app/workshops/page')).default;
    const { container } = render(shellOnly(await Page({ searchParams: sp })) as React.ReactElement);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Creative workshops & pop-ups');
    expect(screen.getByRole('status').textContent).toBe('Loading workshops…');
    expect(container.querySelector('.sk-filters')).toBeTruthy();
  });
  it('with nothing scheduled and no filters: the coming-soon page up front, no loader', async () => {
    gate.any = false;
    const Page = (await import('@/app/workshops/page')).default;
    render(shellOnly(await Page({ searchParams: sp })) as React.ReactElement);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('coming soon');
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('nothing scheduled but a filter applied: still the catalog shell', async () => {
    gate.any = false;
    const Page = (await import('@/app/workshops/page')).default;
    render(shellOnly(await Page({ searchParams: Promise.resolve({ city: 'jaipur' }) })) as React.ReactElement);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Creative workshops & pop-ups');
  });
});

describe.each([
  ['posts', '@/app/dashboard/posts/page', 'Loading your products…', { searchParams: sp }],
  ['users', '@/app/dashboard/users/page', 'Loading users…', {}],
  ['listing-requests', '@/app/dashboard/listing-requests/page', 'Loading requests…', {}],
])('dashboard %s', (_n, path, label, props) => {
  it('streams: shell and loader appear while the data never arrives', async () => {
    const Page = (await import(/* @vite-ignore */ path)).default;
    const { container } = render(shellOnly(await Page(props)) as React.ReactElement);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(label);
    expect(container.querySelector('.rr-section-loader')).toBeTruthy();
  });
  it('runs the auth gate before any shell: a denied visitor gets nothing rendered', async () => {
    auth.deny = true;
    const Page = (await import(/* @vite-ignore */ path)).default;
    await expect(Page(props)).rejects.toThrow('REDIRECT');
  });
});
