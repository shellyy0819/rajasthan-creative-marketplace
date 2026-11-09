// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>c</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => <button>l</button> }));
import { ProductCard } from '@/components/ProductCard';

afterEach(cleanup);
const p = { id: 'p1', name: 'Basic', category: 'Crochet', city: 'Udaipur', cityId: 1, citySlug: 'udaipur', pricePaise: 100000, seller: 'shauk and stuff', description: 'd', stock: 1, status: 'APPROVED' };

describe('ProductCard maker avatar', () => {
  it('shows the brand logo when there is one', () => {
    render(<ProductCard p={{ ...p, sellerLogo: 'https://cdn.example.com/logos/u/a.png' }} />);
    expect((document.querySelector('.pc-av img') as HTMLImageElement).src).toBe('https://cdn.example.com/logos/u/a.png');
  });
  it('shows the initial without a logo, and when the logo fails to load', () => {
    render(<ProductCard p={p} />);
    expect(document.querySelector('.pc-av img')).toBeNull();
    expect(document.querySelector('.pc-av')!.textContent).toBe('S');
    cleanup();
    render(<ProductCard p={{ ...p, sellerLogo: 'https://cdn.example.com/logos/u/a.png' }} />);
    fireEvent.error(document.querySelector('.pc-av img')!);
    expect(document.querySelector('.pc-av')!.textContent).toBe('S');
  });
});
