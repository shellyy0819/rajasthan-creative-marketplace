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

describe('ProductImage image that failed before hydration', () => {
  const proto = HTMLImageElement.prototype as any;
  const orig = { complete: Object.getOwnPropertyDescriptor(proto, 'complete'), naturalWidth: Object.getOwnPropertyDescriptor(proto, 'naturalWidth') };
  afterEach(() => {
    for (const k of ['complete', 'naturalWidth'] as const) {
      if (orig[k]) Object.defineProperty(proto, k, orig[k]!); else delete proto[k];
    }
  });
  const stub = (complete: boolean, naturalWidth: number) => {
    Object.defineProperty(proto, 'complete', { configurable: true, get: () => complete });
    Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => naturalWidth });
  };
  it('falls back when the browser already marked the image broken (error fired before React attached)', () => {
    stub(true, 0);
    render(<ProductImage src="https://user:pw@example.com/x.jpg" alt="x" fallback={fb} />);
    expect(screen.getByTestId('fallback')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('keeps a loaded image', () => {
    stub(true, 120);
    render(<ProductImage src="https://cdn.example.com/a.jpg" alt="x" fallback={fb} />);
    expect(screen.getByRole('img')).toBeTruthy();
    expect(screen.queryByTestId('fallback')).toBeNull();
  });
  it('keeps an image that is still loading', () => {
    stub(false, 0);
    render(<ProductImage src="https://cdn.example.com/slow.jpg" alt="x" fallback={fb} />);
    expect(screen.getByRole('img')).toBeTruthy();
  });
  describe('our own bucket photos are shown as resized copies', () => {
    const S3 = 'https://bkt.s3.ap-south-1.amazonaws.com/products/u/a.jpg';
    it('asks the resizer, with a srcset and sizes', () => {
      render(<ProductImage src={S3} alt="Pot" fallback={fb} sizes="300px" />);
      const img = screen.getByRole('img', { name: 'Pot' });
      expect(img.getAttribute('src')).toBe(`/api/photo?w=960&u=${encodeURIComponent(S3)}`);
      expect(img.getAttribute('srcset')).toContain('480w');
      expect(img.getAttribute('sizes')).toBe('300px');
    });
    it('uses the original when the resizer fails, and the fallback only if that fails too', () => {
      render(<ProductImage src={S3} alt="Pot" fallback={fb} />);
      fireEvent.error(screen.getByRole('img'));
      const img = screen.getByRole('img', { name: 'Pot' });
      expect(img.getAttribute('src')).toBe(S3);
      expect(img.hasAttribute('srcset')).toBe(false);
      expect(screen.queryByTestId('fallback')).toBeNull();
      fireEvent.error(img);
      expect(screen.getByTestId('fallback')).toBeTruthy();
    });
    it('leaves other hosts alone', () => {
      render(<ProductImage src="https://cdn.example.com/a.jpg" alt="x" fallback={fb} />);
      expect(screen.getByRole('img').hasAttribute('srcset')).toBe(false);
    });
  });
});
