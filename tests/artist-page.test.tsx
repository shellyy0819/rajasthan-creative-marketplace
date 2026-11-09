// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/lib/track', () => ({ sendEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ gaEvent: vi.fn() }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => <button>like</button> }));
vi.mock('@/components/TrackOnMount', () => ({ TrackOnMount: () => null }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
const data = vi.hoisted(() => ({ getArtist: vi.fn() }));
vi.mock('@/lib/artists', () => ({ getArtist: data.getArtist }));
import ArtistPage from '@/app/artists/[slug]/page';

afterEach(cleanup);
const artist = (n: number) => ({
  name: 'Shauk and Stuff', slug: 'shauk-12345678', city: 'Udaipur',
  products: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Piece ${i + 1}`, category: 'Crochet', city: 'Udaipur', cityId: 1, citySlug: 'u', pricePaise: 10000, seller: 'Shauk and Stuff', description: 'd', stock: 3, status: 'APPROVED', sellerSlug: 'shauk-12345678' })),
});
const show = async (n: number) => { data.getArtist.mockResolvedValue(artist(n)); render(await ArtistPage({ params: Promise.resolve({ slug: 'shauk-12345678' }), searchParams: Promise.resolve({}) })); };

describe('artist page', () => {
  it.each([[1, 1], [2, 2], [3, 3], [5, 3]])('%i products: one h1, %i hero cards', async (n, cards) => {
    await show(n);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelectorAll('a.ah-card')).toHaveLength(cards);
  });
  it('with 3 or fewer products there is no grid at all (the hero shows every piece)', async () => {
    await show(2);
    expect(document.querySelector('.product-grid')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'More pieces' })).toBeNull();
    cleanup();
    await show(3);
    expect(document.querySelector('.product-grid')).toBeNull();
  });
  it('with 5 products a "More pieces" heading counts the remaining 2 and the grid holds only those', async () => {
    await show(5);
    expect(screen.getByRole('heading', { name: 'More pieces' })).toBeTruthy();
    expect(document.querySelector('.section-heading .muted')!.textContent).toBe('2 pieces');
    const cards = [...document.querySelectorAll('.product-grid .product-card h3')].map(h => h.textContent);
    expect(cards).toEqual(['Piece 4', 'Piece 5']);
  });
  it('with 4 products the count is singular', async () => {
    await show(4);
    expect(document.querySelector('.section-heading .muted')!.textContent).toBe('1 piece');
  });
});
