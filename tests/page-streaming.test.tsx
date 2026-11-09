// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { shellOnly } from './helpers/resolve-async';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
// The data never arrives: the page function must still return its shell.
const never = vi.hoisted(() => () => new Promise<never>(() => {}));
vi.mock('@/lib/catalog', () => ({ listProducts: never, listWorkshops: never }));
vi.mock('@/lib/categories', () => ({ listCategories: never }));
vi.mock('@/lib/cities', () => ({ listActiveCities: never }));
vi.mock('@/lib/trending', () => ({ trending: never }));

afterEach(cleanup);
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
    expect(loader.getAttribute('aria-busy')).toBe('true');
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
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
  });
});
