// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/lib/track', () => ({ sendEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ gaEvent: vi.fn() }));
import { ArtistHero } from '@/components/ArtistHero';
import type { Product, Workshop } from '@/lib/types';

afterEach(cleanup);
const piece = { id: 'p1', name: 'Bowl', category: 'Pottery', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 1000, seller: 'Swati', description: 'd', stock: 1, status: 'APPROVED', sellerSlug: 'swati-12345678' } as Product;
const cls = (id: string) => ({ id, kind: 'class', mode: 'online', topic: { id: 1, name: 'Yoga', slug: 'yoga' } }) as Workshop;
const shop = (id: string) => ({ id, kind: 'workshop', mode: 'in_person', topic: { id: 1, name: 'Yoga', slug: 'yoga' } }) as Workshop;
const show = (products: Product[], workshops: Workshop[]) => render(<ArtistHero a={{ name: 'Swati', slug: 'swati-12345678', city: 'Jaipur', instagram: '@swati', products, workshops }} />);

describe('the profile heading by what the person does', () => {
  it('sells pieces: MEET THE MAKER, with the pieces and the contact sheet', () => {
    show([piece], []);
    expect(screen.getByText('MEET THE MAKER')).toBeTruthy();
    expect(document.querySelector('.ah-row')).toBeTruthy();
    expect(screen.getByRole('button', { name: /contact/i })).toBeTruthy();
  });
  it('sells pieces and teaches too: still MEET THE MAKER, and the chips count both', () => {
    show([piece], [cls('w1')]);
    expect(screen.getByText('MEET THE MAKER')).toBeTruthy();
    expect(document.querySelector('.ah-chips')!.textContent).toBe('JaipurPottery1 piece1 classes');
  });
  it('only classes: MEET YOUR INSTRUCTOR, no piece row, no product contact sheet, the Instagram link stays', () => {
    show([], [cls('w1'), cls('w2')]);
    expect(screen.getByText('MEET YOUR INSTRUCTOR')).toBeTruthy();
    expect(screen.queryByText('MEET THE MAKER')).toBeNull();
    expect(document.querySelector('.ah-row')).toBeNull();
    expect(screen.queryByRole('button', { name: /contact/i })).toBeNull();
    expect(document.querySelector('.ah-chips')!.textContent).toBe('JaipurYoga2 classes');
    expect(screen.getByText('Instagram ↗')).toBeTruthy();
  });
  it('workshops, alone or with classes: MEET YOUR HOST', () => {
    show([], [shop('w1')]);
    expect(screen.getByText('MEET YOUR HOST')).toBeTruthy();
    cleanup();
    show([], [shop('w1'), cls('w2')]);
    expect(screen.getByText('MEET YOUR HOST')).toBeTruthy();
    expect(screen.queryByText(/MEET THE MAKER/)).toBeNull();
  });
});

describe('the piece photos on a profile', () => {
  it('show the whole photo (contain), not a cropped one', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.ah-photo \.product-photo \{ object-fit: contain; \}/);
  });
});
