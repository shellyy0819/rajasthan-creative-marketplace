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

  it('has its own tab in the admin tabs', () => {
    render(<AdminTabs />);
    expect(screen.getByRole('link', { name: 'Seller engagement' }).getAttribute('href')).toBe('/dashboard/engagement');
  });
});
