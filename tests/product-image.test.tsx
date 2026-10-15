// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ProductImage } from '@/components/ProductImage';

afterEach(cleanup);
const fb = <span data-testid="fallback">emoji</span>;

describe('ProductImage', () => {
  it('renders a safe lazy image with alt text', () => {
    render(<ProductImage src="https://cdn.example.com/a.jpg" alt="Lac Bangle" fallback={fb} />);
    const img = screen.getByRole('img', { name: 'Lac Bangle' });
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(screen.queryByTestId('fallback')).toBeNull();
  });
  it('shows the fallback when there is no url', () => {
    render(<ProductImage alt="x" fallback={fb} />);
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('falls back when the image fails to load', () => {
    render(<ProductImage src="https://cdn.example.com/broken.jpg" alt="x" fallback={fb} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
