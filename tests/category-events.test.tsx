// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ga = vi.hoisted(() => ({ gaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ga);
vi.mock('next/link', () => ({ default: ({ href, children, onClick, ...r }: any) => <a href={href} onClick={e => { e.preventDefault(); onClick?.(e); }} {...r}>{children}</a> }));

import { CategoryLink } from '@/components/CategoryLink';
import { CategoryListTracker } from '@/components/CategoryListTracker';
import { gaContactSeller } from '@/lib/ga-events';

beforeEach(() => ga.gaEvent.mockClear());
afterEach(cleanup);

describe('GA4 category events', () => {
  it('category_click says which category and where it was clicked', () => {
    render(<CategoryLink slug="pottery" source="home">Pottery</CategoryLink>);
    fireEvent.click(screen.getByText('Pottery'));
    expect(ga.gaEvent).toHaveBeenCalledWith('category_click', { category_slug: 'pottery', source: 'home' });
    expect(screen.getByText('Pottery').closest('a')?.getAttribute('href')).toBe('/categories/pottery');
  });

  it('view_item_list fires once per category page and page number, even when React re-renders', () => {
    const { rerender } = render(<CategoryListTracker slug="pottery" page={1}><p>x</p></CategoryListTracker>);
    rerender(<CategoryListTracker slug="pottery" page={1}><p>x</p></CategoryListTracker>);
    expect(ga.gaEvent.mock.calls).toEqual([['view_item_list', { item_list_id: 'pottery', item_list_name: 'pottery', page: 1 }]]);
    rerender(<CategoryListTracker slug="pottery" page={2}><p>x</p></CategoryListTracker>);
    expect(ga.gaEvent).toHaveBeenCalledTimes(2);
  });

  it('select_item fires when a product link in the list is clicked, with that card\'s product id; other clicks send nothing', () => {
    render(
      <CategoryListTracker slug="pottery" page={1}>
        <article data-product-id="p7"><a href="/products/blue-vase-p7" onClick={e => e.preventDefault()}>Blue vase</a><button>Like</button></article>
        <article data-product-id="p8"><a href="/artists/x" onClick={e => e.preventDefault()}>Artist</a></article>
      </CategoryListTracker>,
    );
    ga.gaEvent.mockClear();
    fireEvent.click(screen.getByText('Like'));
    fireEvent.click(screen.getByText('Artist'));
    expect(ga.gaEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Blue vase'));
    expect(ga.gaEvent).toHaveBeenCalledWith('select_item', { item_id: 'p7', item_list_id: 'pottery', item_list_name: 'pottery' });
  });

  it('contact_seller carries the product\'s category as item_category, only for a product contact', () => {
    gaContactSeller({ sellerSlug: 'a-1', method: 'call', productId: 'p1', category: 'Pottery' });
    expect(ga.gaEvent).toHaveBeenCalledWith('contact_seller', { seller_id: 'a-1', contact_method: 'call', product_id: 'p1', item_category: 'Pottery' });
    ga.gaEvent.mockClear();
    gaContactSeller({ sellerSlug: 'a-1', method: 'call', category: 'Pottery' });     // artist page: no product, so no category
    expect(ga.gaEvent).toHaveBeenCalledWith('contact_seller', { seller_id: 'a-1', contact_method: 'call' });
  });
});
