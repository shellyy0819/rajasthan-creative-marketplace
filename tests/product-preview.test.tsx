// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

const nav = vi.hoisted(() => ({ path: '/products/basic-p1' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>c</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => <button>l</button> }));
import { ProductCard } from '@/components/ProductCard';
import { ProductPreviewShell } from '@/components/ProductPreviewShell';
import ProductLoading from '@/app/products/[slug]/loading';
import { readPreview, rememberPreview } from '@/lib/product-preview';

const p = { id: 'p1', name: 'Basic', category: 'Crochet', city: 'Udaipur', cityId: 1, citySlug: 'udaipur', pricePaise: 100000, seller: 'Shauk', description: 'd', stock: 1, status: 'APPROVED', imageUrl: 'https://cdn.example.com/a.jpg' };

beforeEach(() => { sessionStorage.clear(); nav.path = '/products/basic-p1'; });
afterEach(cleanup);

describe('product page opens with the card\'s data', () => {
  it('clicking the card title remembers its data for the page\'s loading screen', () => {
    render(<ProductCard p={p} />);
    expect(readPreview('/products/basic-p1')).toBeUndefined();
    fireEvent.click(screen.getByRole('link', { name: 'Basic' }));
    expect(readPreview('/products/basic-p1')).toMatchObject({ name: 'Basic', category: 'Crochet', pricePaise: 100000, seller: 'Shauk', city: 'Udaipur', imageUrl: p.imageUrl });
  });
  it('the loading screen shows that title, price, maker and photo at once', async () => {
    rememberPreview('/products/basic-p1', { name: 'Basic', category: 'Crochet', pricePaise: 100000, imageUrl: p.imageUrl, seller: 'Shauk', city: 'Udaipur', variant: 1 });
    render(<ProductPreviewShell />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Basic'));
    expect(document.querySelector('.detail-price .price')!.textContent).toContain('1,000');
    expect(document.body.textContent).toContain('Shauk · Udaipur');
    expect(document.querySelector('.product-photo')).not.toBeNull();
  });
  it('a direct visit (no card) shows placeholders only', () => {
    nav.path = '/products/direct-p77';
    render(<ProductLoading />);
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(3);
    expect(screen.getByRole('status').textContent).toBe('Loading product');
  });
  it('another product\'s data is never shown', async () => {
    nav.path = '/products/basic-p3';
    rememberPreview('/products/other-p2', { name: 'Other', category: 'x', pricePaise: 1, seller: 's', city: 'c', variant: 0 });
    render(<ProductPreviewShell />);
    await Promise.resolve();
    expect(document.querySelector('h1')).toBeNull();
  });
  it('still works when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => rememberPreview('/products/x-p9', { name: 'X', category: 'c', pricePaise: null, seller: 's', city: 'c', variant: 0 })).not.toThrow();
    expect(readPreview('/products/x-p9')?.name).toBe('X');
    spy.mockRestore();
  });
});

describe('product page source', () => {
  it('reads the product once per request', () => {
    const src = fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8');
    expect(src).toContain('cache(getProductBySlug)');
    expect(src.match(/getProductBySlug\(/g)).toBeNull();
  });
});
