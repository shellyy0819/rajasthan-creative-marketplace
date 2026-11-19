// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityRef" /> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/dashboard/posts', useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));

import { SellerWorkshops } from '@/components/SellerWorkshops';
import type { Workshop } from '@/lib/types';

const w = { id: 'w1', title: 'Morning Flow', kind: 'class', mode: 'online', topicId: null, endsOn: '2099-03-30', platform: 'Zoom', schedule: { repeat: 'weekly', days: ['mon'], time: '07:00', durationMin: 60 }, languages: ['English'], level: null, experience: null, certifications: null, freeTrial: false, freeTrialDays: null, whatsapp: '9989898999', instagram: null, website: null, images: [], prices: [], booked: 0, status: 'APPROVED', type: 'FREE', pricePaise: 0, city: null, cityId: null, citySlug: null, venue: null, seats: null, date: '2099-01-05', time: '07:00', host: 'Yoga with Swati', description: 'Gentle yoga.', hostId: 'u1', contactEmail: 'swati@x.co' } as unknown as Workshop;
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('My workshops on the seller dashboard', () => {
  it('lists each workshop with its status and a link to its public page when published', () => {
    render(<SellerWorkshops initial={[w, { ...w, id: 'w2', title: 'Draft Flow', status: 'DRAFT' }]} topics={[]} />);
    expect(screen.getByRole('heading', { name: /my workshops/i })).toBeTruthy();
    const row = screen.getByText('Morning Flow').closest('tr') as HTMLElement;
    expect(within(row).getByText('Published')).toBeTruthy();
    expect(within(row).getByRole('link', { name: /view/i }).getAttribute('href')).toMatch(/^\/workshops\/.*w1$/);
    const draft = screen.getByText('Draft Flow').closest('tr') as HTMLElement;
    expect(within(draft).getByText('Draft')).toBeTruthy();
    expect(within(draft).queryByRole('link', { name: /view/i })).toBeNull();
  });
  it('Edit opens the form without a Status choice, and saving keeps the status and shows the new title', async () => {
    fetchMock.mockImplementation(async (_u: string, init: RequestInit) => ({ ok: true, status: 200, json: async () => ({ ...w, title: JSON.parse(String(init.body)).title }) }));
    render(<SellerWorkshops initial={[w]} topics={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Morning Flow' }));
    const dlg = await screen.findByRole('dialog', { name: /edit workshop/i });
    expect(within(dlg).queryByLabelText(/^status/i)).toBeNull();
    fireEvent.change(within(dlg).getByLabelText(/class title/i), { target: { value: 'Evening Flow' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshops/w1', expect.objectContaining({ method: 'PATCH' })));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).status).toBe('APPROVED');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Evening Flow')).toBeTruthy();
  });
  it('has no Delete, Publish or Archive buttons and no per-row status choice', () => {
    render(<SellerWorkshops initial={[w]} topics={[]} />);
    expect(screen.queryByRole('button', { name: /delete|publish|archive/i })).toBeNull();
    expect(screen.queryByLabelText(/^status of/i)).toBeNull();
  });
  it('shows the table headers and a Host a Workshop button even with no workshops yet', () => {
    render(<SellerWorkshops initial={[]} topics={[]} />);
    for (const h of ['Title', 'When', 'Status', 'Actions']) expect(screen.getByRole('columnheader', { name: h })).toBeTruthy();
    expect(screen.getByText(/no workshops yet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /host a workshop/i })).toBeTruthy();
  });
  it('searches by title and filters by status', () => {
    render(<SellerWorkshops initial={[w, { ...w, id: 'w2', title: 'Draft Flow', status: 'DRAFT' }]} topics={[]} />);
    fireEvent.change(screen.getByLabelText('Search workshops'), { target: { value: 'draft' } });
    expect(screen.queryByText('Morning Flow')).toBeNull();
    expect(screen.getByText('Draft Flow')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search workshops'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'APPROVED' } });
    expect(screen.queryByText('Draft Flow')).toBeNull();
    expect(screen.getByText('Morning Flow')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search workshops'), { target: { value: 'zzz' } });
    expect(screen.getByText(/no workshops match/i)).toBeTruthy();
  });
});
