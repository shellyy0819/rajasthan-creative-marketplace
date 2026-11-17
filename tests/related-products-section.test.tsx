// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ProductCard', () => ({ ProductCard: ({ p }: any) => <article>{p.name}</article> }));
const related = vi.hoisted(() => ({ get: vi.fn(), slug: vi.fn() }));
vi.mock('@/lib/category-pages', () => ({ slugForCategory: related.slug }));
vi.mock('@/lib/related-products', () => ({ MAKER_LIMIT: 4, SIMILAR_LIMIT: 8, getRelatedProducts: related.get }));

import { RelatedProducts } from '@/components/RelatedProducts';
import type { Product } from '@/lib/types';

afterEach(() => { cleanup(); related.get.mockReset(); related.slug.mockReset(); });

const prod = (id: string, name: string) => ({ id, name } as Product);
const current = { id: 'p1', name: 'Current', category: 'Paintings & Prints', seller: 'Studio A', sellerSlug: 'studio-a-1a2b3c4d' } as Product;

describe('RelatedProducts', () => {
  it('shows both sections with their links and products', async () => {
    related.slug.mockResolvedValue('paintings-and-prints');
    related.get.mockResolvedValue({ fromMaker: [prod('p2', 'Maker piece')], similar: [prod('p3', 'Similar piece')] });
    const { container } = render(<>{await RelatedProducts({ product: current })}</>);
    expect(screen.getByRole('heading', { name: 'More from Studio A' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /View all/ }).getAttribute('href')).toBe('/artists/studio-a-1a2b3c4d');
    expect(screen.getByRole('heading', { name: 'Similar products' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /See all Paintings & Prints/ }).getAttribute('href')).toBe('/categories/paintings-and-prints');
    expect(container.textContent).toContain('Maker piece');
    expect(container.textContent).toContain('Similar piece');
  });
  it('leaves out "More from" when the maker has nothing else', async () => {
    related.get.mockResolvedValue({ fromMaker: [], similar: [prod('p3', 'Similar piece')] });
    render(<>{await RelatedProducts({ product: current })}</>);
    expect(screen.queryByRole('heading', { name: /More from/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Similar products' })).toBeTruthy();
  });
  it('renders nothing when both lists are empty', async () => {
    related.get.mockResolvedValue({ fromMaker: [], similar: [] });
    expect(await RelatedProducts({ product: current })).toBeNull();
  });
  it('the See all link falls back to the filtered shop only when the category has no page', async () => {
    related.slug.mockResolvedValue(undefined);
    related.get.mockResolvedValue({ fromMaker: [], similar: [prod('p3', 'Similar piece')] });
    render(<>{await RelatedProducts({ product: current })}</>);
    expect(screen.getByRole('link', { name: /See all Paintings & Prints/ }).getAttribute('href')).toBe('/shop?category=Paintings%20%26%20Prints');
  });
});
