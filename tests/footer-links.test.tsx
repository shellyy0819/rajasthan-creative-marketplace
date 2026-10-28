// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

vi.mock('next/server', async orig => ({ ...(await orig<typeof import('next/server')>()), connection: async () => undefined }));
vi.mock('@/lib/cities', () => ({ listActiveCities: async () => [{ id: 1, name: 'Udaipur', slug: 'udaipur', state: 'Rajasthan' }] }));

import { Footer } from '@/components/Footer';
import { SITE } from '@/lib/site';

afterEach(cleanup);

const links = (name: string) => Array.from(within(screen.getByRole('navigation', { name })).getAllByRole('link')).map(a => [a.textContent, a.getAttribute('href')]);

describe('footer', () => {
  it('has Get to Know Us, Connect with Us and Let Us Help You columns with working links', async () => {
    render(await Footer());
    expect(links('Get to Know Us')).toEqual([['About us', '/about'], ['Blogs', '/blogs']]);
    expect(links('Connect with Us')).toEqual([['Contact us', '/contact']]);
    expect(links('Let Us Help You')).toEqual([['How it works', '/help'], ['For makers', `mailto:${SITE.email}?subject=Marketplace%20seller%20interest`]]);
  });
  it('keeps the city links and puts Cookie settings under Let Us Help You', async () => {
    render(await Footer());
    expect(links('Cities')).toEqual([['Udaipur', '/cities/udaipur']]);
    expect(within(screen.getByRole('navigation', { name: 'Let Us Help You' })).getByRole('button', { name: 'Cookie settings' })).toBeTruthy();
  });
  it('keeps the demo note and the brand in the bottom strip', async () => {
    render(await Footer());
    expect(screen.getByText(/Payments are not enabled/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Craftology home' })).toBeTruthy();
  });
});
