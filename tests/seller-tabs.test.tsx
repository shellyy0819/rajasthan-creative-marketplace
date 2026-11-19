import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SellerTabs } from '@/components/SellerTabs';
import { sellerTab } from '@/lib/new-post-param';

describe('seller dashboard tabs', () => {
  it('?tab=workshops is the workshops tab; anything else is products', () => {
    expect(sellerTab({ tab: 'workshops' })).toBe('workshops');
    expect(sellerTab({})).toBe('products');
    expect(sellerTab({ tab: 'x' })).toBe('products');
    expect(sellerTab({ tab: ['workshops'] })).toBe('products');
  });
  it('shows My Products and My Workshops, with the current one marked', () => {
    const h = renderToStaticMarkup(<SellerTabs current="workshops" />);
    expect(h).toContain('>My Products<');
    expect(h).toContain('>My Workshops<');
    expect(h).toMatch(/<a aria-current="page" href="\/dashboard\/posts\?tab=workshops">My Workshops/);
    expect(h).toMatch(/<a href="\/dashboard\/posts">My Products/);
    expect(renderToStaticMarkup(<SellerTabs current="products" />)).toMatch(/<a aria-current="page" href="\/dashboard\/posts">My Products/);
  });
});
