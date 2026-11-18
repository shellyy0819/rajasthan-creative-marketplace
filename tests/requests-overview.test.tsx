// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
import { PREVIEW, RequestsOverview } from '@/components/RequestsOverview';
import type { CityRequest } from '@/lib/city-requests';
import type { ListingRequest } from '@/lib/listing-requests';
import type { WorkshopRequest } from '@/lib/workshop-requests';

afterEach(cleanup);
const city = (i: number, over: Partial<CityRequest> = {}): CityRequest => ({ id: `c${i}`, requestedBy: `s${i}@x.co`, name: `Chintal ${i}`, placeLabel: `Chintal, Telangana`, state: 'Telangana', status: 'live', createdAt: '2026-11-16T10:00:00.000Z', ...over });
const listing = (i: number, over: Partial<ListingRequest> = {}): ListingRequest => ({ id: `l${i}`, ownerName: `Owner ${i}`, phone: '+919989898999', email: `o${i}@x.co`, businessName: `Studio ${i}`, size: 'small', status: 'received', createdAt: '2026-11-15T10:00:00.000Z', ...over });
const workshop = (i: number, over: Partial<WorkshopRequest> = {}): WorkshopRequest => ({ id: `w${i}`, hostName: `Host ${i}`, contactName: 'C', phone: '1', email: 'h@x.co', city: 'Jaipur', venue: 'V', title: `Block printing ${i}`, kind: 'workshop', description: 'd', startDate: '2099-12-01', endDate: '2099-12-01', status: 'received', emailVerified: true, images: [], priceType: 'FREE', ...over } as WorkshopRequest);
const block = (heading: RegExp) => screen.getByRole('heading', { name: heading }).closest('section')!;

describe('RequestsOverview', () => {
  it('has a heading for each kind of request, starting with New city', () => {
    render(<RequestsOverview cities={[city(1)]} listings={[listing(1)]} workshops={[workshop(1)]} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent?.replace(/\d+$/, '').trim())).toEqual(['New city', 'Listing requests', 'Workshop requests']);
  });
  it('numbers the requests under their heading, with who added them, the date and the status', () => {
    render(<RequestsOverview cities={[city(1, { requestedByName: 'Lakshmi' }), city(2, { status: 'approved' }), city(3, { status: 'removed' })]} listings={[]} workshops={[]} />);
    const b = block(/New city/), items = within(b).getAllByRole('listitem');
    expect(b.querySelector('ol')).toBeTruthy();
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toMatch(/Chintal 1, Telangana.*added by Lakshmi.*16 Nov 2026.*Auto-approved/);
    expect(items[1].textContent).toMatch(/Chintal 2.*s2@x\.co.*Confirmed/);
    expect(items[2].textContent).toMatch(/Chintal 3.*Removed/);
    expect(within(b).getByRole('heading', { level: 2 }).textContent).toMatch(/3$/);   // the count
  });
  it('lists listing and workshop requests with their status', () => {
    render(<RequestsOverview cities={[]} listings={[listing(1), listing(2, { status: 'confirmed' })]} workshops={[workshop(1), workshop(2, { status: 'unverified', emailVerified: false })]} />);
    expect(within(block(/Listing requests/)).getAllByRole('listitem').map(li => li.textContent)).toEqual([expect.stringMatching(/Studio 1.*Owner 1.*Received/), expect.stringMatching(/Studio 2.*Confirmed/)]);
    expect(within(block(/Workshop requests/)).getAllByRole('listitem').map(li => li.textContent)).toEqual([expect.stringMatching(/Block printing 1.*Host 1, Jaipur.*Received/), expect.stringMatching(/Block printing 2.*Email not confirmed/)]);
  });
  it('says so when a kind has none', () => {
    render(<RequestsOverview cities={[]} listings={[]} workshops={[]} />);
    expect(screen.getByText('No new city requests.')).toBeTruthy(); expect(screen.getByText('No listing requests.')).toBeTruthy(); expect(screen.getByText('No workshop requests.')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
  it('shows the first 15 of a kind and says how many more there are', () => {
    render(<RequestsOverview cities={Array.from({ length: PREVIEW + 4 }, (_, i) => city(i + 1))} listings={[]} workshops={[]} />);
    expect(within(block(/New city/)).getAllByRole('listitem')).toHaveLength(PREVIEW);
    expect(screen.getByText(/and 4 more/)).toBeTruthy();
    expect(screen.getByText(/City requests tab/)).toBeTruthy();
  });
  it('has no Manage buttons: the dashboard tabs already link to each kind\'s own page', () => {
    render(<RequestsOverview cities={[]} listings={[]} workshops={[]} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText(/manage/i)).toBeNull();
  });
});
