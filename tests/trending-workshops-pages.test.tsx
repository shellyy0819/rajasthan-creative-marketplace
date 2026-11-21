// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/server', async orig => ({ ...(await orig<typeof import('next/server')>()), connection: async () => undefined }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: ({ workshop }: any) => <button>reserve {workshop.id}</button> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>add</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => null }));
vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), unstable_cache: (fn: unknown) => fn })); // no Next cache outside a request
vi.mock('@/lib/admin-page', () => ({ requireAdminPage: vi.fn(), requireStaffPage: vi.fn() }));
vi.mock('@/lib/hosts', async orig => ({ ...(await orig<typeof import('@/lib/hosts')>()), hostConfig: () => ({}) }));

import AdminTrendingPage from '@/app/dashboard/trending/page';
import TrendingPage from '@/app/trending/page';
import { TrendingWorkshopsSection } from '@/components/TrendingWorkshopsSection';
import { createWorkshop } from '@/lib/admin';
import { recordWorkshopEvent } from '@/lib/engagement';
import { cityRef } from './helpers/cities';
import { resetTestDb } from './helpers/testdb';

const base = { type: 'FREE', cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 20, host: 'Marwar Lac', description: 'Learn lac craft.', status: 'APPROVED' };
beforeEach(async () => { await resetTestDb(); });
afterEach(cleanup);

describe('Trending workshops on the home page', () => {
  it('renders nothing while no workshop is trending', async () => {
    expect(await TrendingWorkshopsSection()).toBeNull();
  });
  it('shows a "Trending workshops" row with a Show all link and a card for each trending workshop', async () => {
    const w = await createWorkshop({ ...base, title: 'Lac Craft' });
    await recordWorkshopEvent({ workshopId: w.id, type: 'contact', actor: 'h:a' });
    render(await TrendingWorkshopsSection());
    expect(screen.getByRole('heading', { name: 'Trending workshops' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Show all/ }).getAttribute('href')).toBe('/trending#workshops');
    expect(document.querySelectorAll('.workshop-card')).toHaveLength(1);
    expect(screen.getByText('Lac Craft')).toBeTruthy();
  });
});

describe('the /trending page', () => {
  it('has no workshops section until one trends, and still shows the products', async () => {
    render(await TrendingPage());
    expect(screen.queryByRole('heading', { name: 'Trending workshops' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });
  it('shows a Trending workshops section under the products, anchored as #workshops', async () => {
    const w = await createWorkshop({ ...base, title: 'Block Print' });
    await recordWorkshopEvent({ workshopId: w.id, type: 'contact', actor: 'h:a' });
    const { container } = render(await TrendingPage());
    expect(screen.getByRole('heading', { name: 'Trending workshops' })).toBeTruthy();
    expect(container.querySelector('section#workshops')).toBeTruthy();
    expect(container.querySelectorAll('section#workshops .workshop-card')).toHaveLength(1);
  });
});

describe('the admin Trending page', () => {
  it('shows the workshops breakdown under the products one: rules, weights and each workshop\'s numbers', async () => {
    const w = await createWorkshop({ ...base, title: 'Lac Craft' });
    await recordWorkshopEvent({ workshopId: w.id, type: 'contact', actor: 'h:a' });
    render(await AdminTrendingPage());
    expect(screen.getByRole('heading', { name: 'Trending workshops' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Trending workshops' });
    expect(table.textContent).toContain('Lac Craft');
    expect(table.textContent).toContain('Viewers');
    expect(table.textContent).toContain('Contact clicks');
    expect(table.textContent).toContain('Reservations');
    expect(table.textContent).toContain('On the home row');
    expect(document.body.textContent).toContain('no like button for workshops');
    expect(screen.getAllByRole('table').length).toBe(2); // products and workshops
  });
});
