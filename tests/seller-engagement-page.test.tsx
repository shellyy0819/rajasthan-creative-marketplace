// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const gate = vi.hoisted(() => ({ requireAdminPage: vi.fn(async () => undefined) }));
vi.mock('@/lib/admin-page', () => gate);
import AdminEngagementPage from '@/app/dashboard/engagement/page';
import { AdminTabs } from '@/components/AdminTabs';
import { createProduct } from '@/lib/admin';
import { artistSlug } from '@/lib/artist-slug';
import { recordEvent } from '@/lib/engagement';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';
import { makeSeller, resetTestDb } from './helpers/testdb';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/engagement' }));
beforeEach(async () => { await resetTestDb(); gate.requireAdminPage.mockClear(); });
afterEach(cleanup);

describe('/dashboard/engagement', () => {
  it('is admin-only: the page asks the admin gate itself', async () => {
    gate.requireAdminPage.mockRejectedValueOnce(new Error('NOT_FOUND'));
    await expect(AdminEngagementPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  });

  it('shows each seller with who looked, opened the contact options and reached out, and the method', async () => {
    const s = await makeSeller('a@x.co', 'Star Maker');
    const p = (await createProduct({ name: 'Star Pot', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin)).id;
    await recordEvent({ productId: p, type: 'view', actor: 'h:1' });
    await recordEvent({ productId: p, type: 'contact_call', actor: 'h:1' });
    render(await AdminEngagementPage({ searchParams: Promise.resolve({ days: '7' }) }));
    expect(screen.getByRole('heading', { name: 'Seller engagement' })).toBeTruthy();
    const tr = screen.getByText('Star Maker').closest('tr')!;
    expect([...tr.querySelectorAll('td')].map(td => td.textContent)).toEqual(['Star Maker', '1', '0', '1', 'Call 1']);
    expect(screen.getByRole('link', { name: 'Last 7 days' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Last 30 days' }).getAttribute('href')).toBe('/dashboard/engagement?days=30');
  });

  it('the seller name opens the public profile; a seller with nothing published is not linked', async () => {
    const live = await makeSeller('a@x.co', 'Star Maker'); const none = await makeSeller('b@x.co', 'No Listing');
    await createProduct({ name: 'Star Pot', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: live.id }, admin);
    render(await AdminEngagementPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('link', { name: 'Star Maker' }).getAttribute('href')).toBe(`/artists/${artistSlug('Star Maker', live.id)}`);
    expect(screen.queryByRole('link', { name: 'No Listing' })).toBeNull();
    expect(screen.getByText('No Listing').closest('td')!.textContent).toContain('No public profile yet');
    void none;
  });

  it('the site totals sit above the table, and the filters narrow the list but not the totals', async () => {
    const a = await makeSeller('a@x.co', 'Star Maker'); const b = await makeSeller('b@x.co', 'Other Maker');
    const mk = async (sellerId: string, name: string) => (await createProduct({ name, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId }, admin)).id;
    const pa = await mk(a.id, 'Star Pot'); await mk(b.id, 'Other Pot');
    await recordEvent({ productId: pa, type: 'view', actor: 'h:1' }); await recordEvent({ productId: pa, type: 'contact_call', actor: 'h:1' });
    const totals = () => [...document.querySelectorAll('.engagement-totals > div')].map(d => `${d.querySelector('dt')!.textContent}: ${d.querySelector('dd')!.textContent}`);
    render(await AdminEngagementPage({ searchParams: Promise.resolve({ q: 'star' }) }));
    expect(screen.queryByText('Other Maker')).toBeNull();
    expect(totals().slice(0, 3)).toEqual(['Looked: 1', 'Opened contact: 0', 'Reached out: 1']);
    expect(totals()[3]).toMatch(/^Sellers reached out to: 1 of \d+$/); // the fixture has other sellers too
    expect(screen.queryByText('All sellers', { selector: 'td b' })).toBeNull(); // the totals are not a table row
    expect(screen.getByRole('link', { name: 'Clear' }).getAttribute('href')).toBe('/dashboard/engagement?days=30');
    cleanup();
    render(await AdminEngagementPage({ searchParams: Promise.resolve({ activity: 'reached', days: '7' }) }));
    expect(screen.getByRole('link', { name: 'Star Maker' })).toBeTruthy();
    expect(screen.queryByText('Other Maker')).toBeNull();
    expect(screen.getByRole('link', { name: 'Last 30 days' }).getAttribute('href')).toBe('/dashboard/engagement?days=30&activity=reached'); // the window buttons keep the filters
    cleanup();
    render(await AdminEngagementPage({ searchParams: Promise.resolve({ q: 'nobody' }) }));
    expect(screen.getByText('No seller matches these filters.')).toBeTruthy();
  });

  it('has its own tab in the admin tabs', () => {
    render(<AdminTabs />);
    expect(screen.getByRole('link', { name: 'Seller engagement' }).getAttribute('href')).toBe('/dashboard/engagement');
  });
});
