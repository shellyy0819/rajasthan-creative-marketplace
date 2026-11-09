// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import { ListingRequestsAdmin } from '@/components/ListingRequestsAdmin';
import type { ListingRequest } from '@/lib/listing-requests';

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const R: ListingRequest = { id: 'a', ownerName: 'Meera Sharma', phone: '+919989898999', email: 'meera@pottery.in', instagram: '@meerapottery', website: 'https://meerapottery.in', businessName: 'Meera Pottery', size: 'medium', status: 'received', createdAt: '2026-10-30T10:15:00.000Z' };
const rows = () => screen.getAllByRole('row').slice(1);

describe('ListingRequestsAdmin', () => {
  it('shows an honest empty state', () => {
    render(<ListingRequestsAdmin initial={[]} />);
    expect(screen.getByText('No listing requests yet.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('lists every field, with status "Received" and a Confirm button for new requests', () => {
    render(<ListingRequestsAdmin initial={[R, { ...R, id: 'b', instagram: undefined, website: undefined, businessName: 'Second' }]} />);
    expect(rows()).toHaveLength(2);
    const first = within(rows()[0]);
    for (const t of ['Meera Sharma', 'Meera Pottery', 'Medium', 'Received']) expect(first.getByText(t)).toBeTruthy();
    expect(first.getByRole('link', { name: '+919989898999' }).getAttribute('href')).toBe('tel:+919989898999');
    expect(first.getByRole('link', { name: 'meera@pottery.in' }).getAttribute('href')).toBe('mailto:meera@pottery.in');
    const web = first.getByRole('link', { name: /meerapottery\.in$/ });
    expect(web.getAttribute('target')).toBe('_blank'); expect(web.getAttribute('rel')).toContain('noreferrer');
    expect(first.getByRole('link', { name: '@meerapottery' }).getAttribute('href')).toBe('https://www.instagram.com/meerapottery/');
    expect(first.getByRole('button', { name: 'Confirm Meera Pottery' })).toBeTruthy();
    expect(within(rows()[1]).getAllByText('—').length).toBe(2);
  });
  it('confirmed requests show "Confirmed" and the date, with no Confirm button', () => {
    render(<ListingRequestsAdmin initial={[{ ...R, status: 'confirmed', confirmedAt: '2026-10-31T09:00:00.000Z' }]} />);
    const row = within(rows()[0]);
    expect(row.getByText('Confirmed')).toBeTruthy();
    expect(row.queryByRole('button')).toBeNull();
  });
  it('Confirm PATCHes status "confirmed", marks the row Confirmed at once, and shows a green toast', async () => {
    fetchMock.mockImplementation(() => reply(200, { ...R, status: 'confirmed', confirmedAt: '2026-10-31T09:00:00.000Z' }));
    render(<ListingRequestsAdmin initial={[R]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Meera Pottery' }));
    await waitFor(() => expect(within(rows()[0]).getByText('Confirmed')).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/listing-requests/a'); expect(init.method).toBe('PATCH');
    expect(init.headers['content-type']).toBe('application/json'); expect(JSON.parse(init.body)).toEqual({ status: 'confirmed' });
    expect(screen.getByRole('status').textContent).toMatch(/meera@pottery\.in can now sign in as a seller/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no list reload needed
  });
  it('a failed confirm shows the server message in red and leaves the request as Received', async () => {
    fetchMock.mockImplementation(() => reply(409, { error: 'That account is deactivated. Reactivate it under Users first.' }));
    render(<ListingRequestsAdmin initial={[R]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Meera Pottery' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/deactivated/));
    expect(within(rows()[0]).getByText('Received')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm Meera Pottery' })).toBeTruthy();
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Meera Pottery' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Network error/));
  });
  it('shows a busy state and ignores a second click while a confirm is in flight', async () => {
    let release!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { release = r; }));
    render(<ListingRequestsAdmin initial={[R]} />);
    const b = screen.getByRole('button', { name: 'Confirm Meera Pottery' });
    fireEvent.click(b); fireEvent.click(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b.getAttribute('aria-busy')).toBe('true');
    release({ ok: true, status: 200, json: () => Promise.resolve({ ...R, status: 'confirmed', confirmedAt: '2026-10-31T09:00:00.000Z' }) } as Response);
    await waitFor(() => expect(within(rows()[0]).getByText('Confirmed')).toBeTruthy());
  });
  it('never turns a stored value into markup or a javascript: link', () => {
    render(<ListingRequestsAdmin initial={[{ ...R, ownerName: '<b>x</b>', website: 'javascript:alert(1)' }]} />);
    expect(document.querySelector('b')).toBeNull();
    for (const a of Array.from(document.querySelectorAll('a'))) expect(a.getAttribute('href')).not.toMatch(/^javascript:/i);
  });
});

describe('wiring (source contract)', () => {
  it('the home page no longer opens the form (it links to /sell), and only admins see the dashboard tab and page', () => {
    const home = fs.readFileSync('src/app/page.tsx', 'utf8');
    expect(home).not.toContain('<ListingRequestButton');
    expect(home).not.toMatch(/I’m a maker|Marketplace%20seller%20interest/);
    const layout = fs.readFileSync('src/app/dashboard/layout.tsx', 'utf8');
    expect(layout).toMatch(/user\.role === 'admin' && \(\s*<nav[\s\S]*<Link href="\/dashboard\/listing-requests">/);
    const page = fs.readFileSync('src/app/dashboard/listing-requests/page.tsx', 'utf8');
    expect(page).toContain('requireAdminPage()'); expect(page).toContain('<ListingRequestsAdmin');
  });
});
