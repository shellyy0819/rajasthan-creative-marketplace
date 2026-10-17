// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/AddToCartButton', () => ({ AddToCartButton: () => <button>add</button> }));
import { HomeCraftExplorer } from '@/components/HomeCraftExplorer';

afterEach(cleanup);
const p = (id: string, name: string, category: string) => ({ id, name, category, city: 'Jaipur', pricePaise: 10000, seller: 'S', description: 'd', stock: 3, status: 'APPROVED' });
const PRODUCTS = [p('p1', 'Lily Bouquet', 'Crochet & Textiles'), p('p2', 'Frock', 'Crochet & Textiles'), p('p3', 'Coaster Set', 'Resin Art'), p('p4', 'Wood Horse', 'Wooden Toys')];

describe('HomeCraftExplorer uses only real data', () => {
  it('builds its filters from the categories of the products it was given, with real counts', () => {
    render(<HomeCraftExplorer products={PRODUCTS} />);
    const group = screen.getByRole("group", { name: /category/i });
    expect(within(group).getAllByRole('button').map(b => b.textContent)).toEqual(['All 4', 'Crochet & Textiles 2', 'Resin Art 1', 'Wooden Toys 1']);
  });
  it('invents nothing: no hard-coded collections, craft chips or emoji icons', () => {
    render(<HomeCraftExplorer products={PRODUCTS} />);
    for (const fake of ['Desk', 'Aesthetic decor', 'Gifts & keepsakes', 'Home & décor', 'Leather', 'Crochet finds']) expect(document.body.textContent).not.toContain(fake);
    expect(screen.getByRole('group', { name: /category/i }).textContent).not.toMatch(/\p{Extended_Pictographic}|[⌂❋✳]/u);
  });
  it('categories with no published products are not offered', () => {
    render(<HomeCraftExplorer products={[p('p1', 'Only One', 'Pottery')]} />);
    expect(screen.queryByRole('button', { name: /Resin Art/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Pottery/ })).toBeTruthy();
  });
  it('clicking a category shows exactly its products; All and clicking again reset', () => {
    render(<HomeCraftExplorer products={PRODUCTS} />);
    fireEvent.click(screen.getByRole('button', { name: /Resin Art/ }));
    expect([...document.querySelectorAll('.product-card h3')].map(h => h.textContent)).toEqual(['Coaster Set']);
    expect(screen.getByRole('button', { name: /Resin Art/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Resin Art/ }));
    expect(document.querySelectorAll('.product-card')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /Wooden Toys/ }));
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(document.querySelectorAll('.product-card')).toHaveLength(4);
  });
  it('the heading names the selected category and the real count', () => {
    render(<HomeCraftExplorer products={PRODUCTS} />);
    fireEvent.click(screen.getByRole('button', { name: /Crochet/ }));
    expect(document.querySelector('.craft-results-heading')!.textContent).toMatch(/Crochet & Textiles.*2 pieces/);
  });
  it('with no products there are no filter buttons, just the empty state', () => {
    render(<HomeCraftExplorer products={[]} />);
    expect(screen.queryByRole("group", { name: /category/i })).toBeNull();
    expect(screen.getByText('No handmade finds yet. Check back soon.')).toBeTruthy(); // not the filter message: nothing was filtered
    expect(document.body.textContent).not.toContain('Try another city');
  });
});

describe('empty workshop list on the home page', () => {
  it('says there are none yet instead of asking the visitor to change filters', async () => {
    const { WorkshopList } = await import('@/components/WorkshopList');
    render(<WorkshopList workshops={[]} emptyMessage="No workshops are scheduled yet. Check back soon." />);
    expect(screen.getByText('No workshops are scheduled yet. Check back soon.')).toBeTruthy();
    cleanup();
    render(<WorkshopList workshops={[]} />);
    expect(screen.getByText(/Try a different city or filter/)).toBeTruthy(); // filtered views keep the filter hint
  });
});
