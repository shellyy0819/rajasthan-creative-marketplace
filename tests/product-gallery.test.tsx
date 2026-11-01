// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProductGallery } from '@/components/ProductGallery';

afterEach(cleanup);
const IMGS = ['https://x.example/1.jpg', 'https://x.example/2.jpg', 'https://x.example/3.jpg'];
const big = () => document.querySelector('.detail-art img.product-photo') as HTMLImageElement | null;
const thumbs = () => screen.queryAllByRole('button', { name: /^Show photo \d+ of \d+$/ });
const mount = (images: string[]) => render(<ProductGallery images={images} alt="Crochet Bag" fallback={<span data-testid="fallback">🌷</span>} variant={2} />);

describe('ProductGallery', () => {
  it('shows the first photo large, with one thumbnail button per photo and the current one marked', () => {
    mount(IMGS);
    expect(big()!.getAttribute('src')).toBe(IMGS[0]);
    expect(big()!.getAttribute('alt')).toBe('Crochet Bag');
    expect(thumbs().map(b => b.getAttribute('aria-label'))).toEqual(['Show photo 1 of 3', 'Show photo 2 of 3', 'Show photo 3 of 3']);
    expect(thumbs().map(b => b.getAttribute('aria-current'))).toEqual(['true', null, null]);
  });
  it('choosing a thumbnail swaps the large photo and moves the marker; thumbnails are real buttons with decorative images', () => {
    mount(IMGS);
    fireEvent.click(screen.getByRole('button', { name: 'Show photo 2 of 3' }));
    expect(big()!.getAttribute('src')).toBe(IMGS[1]);
    expect(thumbs().map(b => b.getAttribute('aria-current'))).toEqual([null, 'true', null]);
    for (const b of thumbs()) { expect((b as HTMLButtonElement).type).toBe('button'); expect(b.querySelector('img')!.getAttribute('alt')).toBe(''); }
  });
  it('a single photo has no thumbnails; no photos show only the fallback', () => {
    mount([IMGS[0]]);
    expect(big()!.getAttribute('src')).toBe(IMGS[0]); expect(thumbs()).toHaveLength(0);
    cleanup(); mount([]);
    expect(screen.getByTestId('fallback')).toBeTruthy(); expect(thumbs()).toHaveLength(0);
  });
  it('a large photo that fails to load falls back like a single image does', () => {
    mount(IMGS);
    fireEvent.error(big()!);
    expect(screen.getByTestId('fallback')).toBeTruthy();
  });
  it('keeps the visual variant class for the fallback colour', () => {
    mount([]);
    expect(document.querySelector('.detail-art')!.className).toContain('visual-2');
  });
  it('the product page uses the gallery and no longer renders a single ProductImage', () => {
    const src = fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8');
    expect(src).toContain('<ProductGallery');
    expect(src).not.toContain('<ProductImage');
  });
});
