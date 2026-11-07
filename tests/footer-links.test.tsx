// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

vi.mock('next/server', async orig => ({ ...(await orig<typeof import('next/server')>()), connection: async () => undefined }));
vi.mock('@/lib/cities', () => ({ listActiveCities: async () => [{ id: 1, name: 'Udaipur', slug: 'udaipur', state: 'Rajasthan' }] }));

import { Footer } from '@/components/Footer';

afterEach(cleanup);

const links = (name: string) => Array.from(within(screen.getByRole('navigation', { name })).getAllByRole('link')).map(a => [a.textContent, a.getAttribute('href')]);

describe('footer', () => {
  it('has Get to Know Us, Connect with Us and Let Us Help You columns with working links', async () => {
    render(await Footer());
    expect(links('Get to Know Us')).toEqual([['About us', '/about'], ['Blogs', '/blogs']]);
    expect(links('Connect with Us')).toEqual([['Contact us', '/contact']]);
    expect(links('Let Us Help You')).toEqual([['How it works', '/help'], ['For makers', 'mailto:hello.craftofy@gmail.com?subject=Marketplace%20seller%20interest'], ['Seller login', '/dashboard']]);
  });
  // SKIPPED on purpose: Footer.tsx has the Cities column and the Cookie settings link commented out (the owner's choice in PR #7). Remove the skip when it comes back.
  it.skip('keeps the city links and puts Cookie settings under Let Us Help You', async () => {
    render(await Footer());
    expect(links('Cities')).toEqual([['Udaipur', '/cities/udaipur']]);
    expect(within(screen.getByRole('navigation', { name: 'Let Us Help You' })).getByRole('button', { name: 'Cookie settings' })).toBeTruthy();
  });
  it('keeps the brand in the bottom strip (the demo note and the "Made with care" line are commented out)', async () => {
    render(await Footer());
    expect(screen.queryByText(/Payments are not enabled/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Craftofy home' })).toBeTruthy();
  });
});
