// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProductDetail } from '@/components/ProductDetail';
import type { AdminProduct } from '@/lib/types';

afterEach(cleanup);

const P = {
  id: 'p1', name: 'Crochet Lily Bouquet', category: 'Crochet', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 100000, seller: 'Shauk and Stuff',
  description: 'd', stock: 3, status: 'APPROVED', instagram: '@shaukandstuff', sellerId: 's1', sellerEmail: 's@x.co', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
} as AdminProduct;

describe('ProductDetail Instagram', () => {
  it('shows the stored handle as a link that opens the profile in a new tab', () => {
    render(<ProductDetail product={P} role="admin" onEdit={vi.fn()} onClose={vi.fn()} />);
    const a = screen.getByRole('link', { name: /@shaukandstuff/ });
    expect(a.getAttribute('href')).toBe('https://www.instagram.com/shaukandstuff/');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noreferrer');
  });
  it('shows a dash and no link when there is no Instagram', () => {
    render(<ProductDetail product={{ ...P, instagram: undefined }} role="admin" onEdit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
  });
});
