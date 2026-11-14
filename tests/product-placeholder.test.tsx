// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => <button>like</button> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>contact</button> }));
vi.mock('@/components/ArtistAvatar', () => ({ ArtistAvatar: () => <i /> }));
vi.mock('@/components/PhotoButton', () => ({ PhotoButton: ({ children }: any) => <div>{children}</div> }));
import { ProductCard } from '@/components/ProductCard';
import { ProductDetail } from '@/components/ProductDetail';
import { ProductPlaceholder } from '@/components/ProductPlaceholder';
afterEach(cleanup);

const product = (id: string, category: string) => ({ id, name: `Item ${id}`, category, city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 100, seller: 'S', description: 'D', stock: 3, status: 'DRAFT', sellerSlug: 's-12345678', sellerId: 'u', sellerEmail: 'e@x.co' });
const markup = (el: HTMLElement) => el.querySelector('.product-placeholder')?.outerHTML;

describe('missing product photo', () => {
  it('every product shows the identical placeholder, whatever its id or category, on cards and in the admin detail', () => {
    const a = render(<ProductCard p={product('p1', 'Pottery') as never} />);
    const first = markup(a.container);
    expect(first).toBeTruthy();
    cleanup();
    const b = render(<ProductCard p={product('p4', 'Resin Art') as never} />);
    expect(markup(b.container)).toBe(first);
    cleanup();
    const c = render(<ProductDetail product={product('p5', 'Painting') as never} role="admin" onClose={() => {}} onEdit={() => {}} />);
    expect(markup(c.baseElement)).toBe(first);
    expect(markup(render(<ProductPlaceholder />).container)).toBe(first);
  });
  it('no component picks its own emoji as a product photo fallback', () => {
    const files = ['ProductCard', 'ProductDetail', 'PostsAdmin', 'ArtistHero'].map(n => fs.readFileSync(path.resolve('src/components', `${n}.tsx`), 'utf8'));
    for (const src of files) expect(src).not.toMatch(/SYMBOLS|symbolFor|🌸|🧶/);
    expect(fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8')).not.toContain('SYMBOLS');
  });
});
