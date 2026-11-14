// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const isFairOpen = vi.hoisted(() => vi.fn());
vi.mock('@/lib/fair-settings', () => ({ isFairOpen }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'https://rr.test' }));
vi.mock('@/lib/cities', () => ({ listActiveCities: async () => [] }));
vi.mock('@/components/AuthButton', () => ({ AuthButton: () => null }));
vi.mock('@/components/CartButton', () => ({ CartButton: () => null }));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }));

import { Header } from '@/components/Header';

afterEach(cleanup);

describe('the Fair link in the header', () => {
  it('shows by default and is left out while the fair is closed', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Fair' }).getAttribute('href')).toBe('/fair');
    cleanup();
    render(<Header fair={false} />);
    expect(screen.queryByRole('link', { name: 'Fair' })).toBeNull();
    expect(screen.getByRole('link', { name: /shop handmade/i })).toBeTruthy();
  });
});

describe('llms.txt and the fair switch', () => {
  it('lists the fair while open and leaves it out while closed', async () => {
    const { GET } = await import('@/app/llms.txt/route');
    isFairOpen.mockResolvedValue(true);
    expect(await (await GET()).text()).toContain('(https://rr.test/fair)');
    isFairOpen.mockResolvedValue(false);
    expect(await (await GET()).text()).not.toContain('/fair');
  });
});
