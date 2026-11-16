// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CityRequestsAdmin } from '@/components/CityRequestsAdmin';
import type { CityRequest } from '@/lib/city-requests';

const mk = (id: string, name: string, status: CityRequest['status'], extra: Partial<CityRequest> = {}): CityRequest => ({ id, requestedBy: `${id}@x.co`, name, placeLabel: `${name}, Telangana`, state: 'Telangana', status, createdAt: '2026-11-16T10:00:00.000Z', ...extra });
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let fetchMock: ReturnType<typeof vi.fn>;
let fail: string | null;
const INITIAL = [mk('a', 'Hyderabad Nampally', 'live', { requestedByName: 'Lakshmi', note: 'My workshop is here.' }), mk('b', 'Jaipur Bani Park', 'approved'), mk('c', 'Kota Talwandi', 'removed')];

beforeEach(() => {
  fail = null;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const m = /^\/api\/admin\/city-requests\/(.+)$/.exec(url);
    if (!m || init?.method !== 'PATCH') return res(500, { error: 'unexpected' });
    if (fail) return res(500, { error: fail });
    const b = JSON.parse(String(init.body)) as { decision: 'approve' | 'remove' | 'rename'; name?: string };
    const base = INITIAL.find(r => r.id === m[1])!;
    if (b.decision === 'rename') return res(200, { ...base, name: b.name! });
    return res(200, { ...base, status: b.decision === 'approve' ? 'approved' : 'removed', decidedBy: 'boss@x.co' });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const row = (name: string) => screen.getAllByTestId('city-request').find(r => within(r).queryAllByText(new RegExp(name)).length > 0)!;

describe('CityRequestsAdmin', () => {
  it('lists each city with who added it, the note and its state: auto-approved, confirmed or removed', () => {
    render(<CityRequestsAdmin initial={INITIAL} />);
    expect(within(row('Nampally')).getByText('Auto-approved')).toBeTruthy();
    expect(within(row('Nampally')).getByText(/Lakshmi \(a@x\.co\)/)).toBeTruthy();
    expect(within(row('Nampally')).getByText(/My workshop is here\./)).toBeTruthy();
    expect(within(row('Bani Park')).getByText('Confirmed')).toBeTruthy();
    expect(within(row('Talwandi')).getByText('Removed')).toBeTruthy();
    expect(screen.getAllByRole('status').map(x => x.textContent).join(' ')).toMatch(/1 auto-approved and not yet looked at/);
  });
  it('offers what makes sense for each state, and Rename for every one', () => {
    render(<CityRequestsAdmin initial={INITIAL} />);
    expect(within(row('Nampally')).getAllByRole('button').map(b => b.textContent)).toEqual(['Confirm', 'Rename', 'Remove']);
    expect(within(row('Bani Park')).getAllByRole('button').map(b => b.textContent)).toEqual(['Rename', 'Remove']);
    expect(within(row('Talwandi')).getAllByRole('button').map(b => b.textContent)).toEqual(['Restore', 'Rename']);
  });
  it('confirms, removes and restores, with a toast each time', async () => {
    render(<CityRequestsAdmin initial={INITIAL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Hyderabad Nampally' }));
    await waitFor(() => expect(within(row('Nampally')).getByText('Confirmed')).toBeTruthy());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ decision: 'approve' });
    expect(screen.getAllByRole('status').map(s => s.textContent).join(' ')).toMatch(/“Hyderabad Nampally” confirmed/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Jaipur Bani Park' }));
    await waitFor(() => expect(within(row('Bani Park')).getByText('Removed')).toBeTruthy());
    expect(screen.getAllByRole('status').map(s => s.textContent).join(' ')).toMatch(/removed from the City field\. Cities already created from it stay/);
    fireEvent.click(screen.getByRole('button', { name: 'Restore Kota Talwandi' }));
    await waitFor(() => expect(within(row('Talwandi')).getByText('Confirmed')).toBeTruthy());
    expect(screen.getAllByRole('status').map(s => s.textContent).join(' ')).toMatch(/“Kota Talwandi” is back in the City field/);
  });
  it('shows an error toast and keeps the state when it fails', async () => {
    fail = 'Something broke.';
    render(<CityRequestsAdmin initial={INITIAL} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hyderabad Nampally' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Something broke/));
    expect(within(row('Nampally')).getByText('Auto-approved')).toBeTruthy();
  });
  it('says so when there are none', () => {
    render(<CityRequestsAdmin initial={[]} />);
    expect(screen.getByText('No city requests yet.')).toBeTruthy();
  });
});

describe('CityRequestsAdmin: Rename', () => {
  const open = (city: string) => fireEvent.click(screen.getByRole('button', { name: `Rename ${city}` }));
  it('turns the name into a box to edit, and saves the new name with a toast', async () => {
    render(<CityRequestsAdmin initial={INITIAL} />);
    open('Hyderabad Nampally');
    const box = screen.getByLabelText('New name for Hyderabad Nampally') as HTMLInputElement;
    expect(box.value).toBe('Hyderabad Nampally');
    fireEvent.change(box, { target: { value: 'Nampally Hyderabad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name for Hyderabad Nampally' }));
    await waitFor(() => expect(within(row('Nampally Hyderabad')).getByText('Auto-approved')).toBeTruthy());   // the status did not change
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ decision: 'rename', name: 'Nampally Hyderabad' });
    expect(screen.getAllByRole('status').map(x => x.textContent).join(' ')).toMatch(/Renamed to “Nampally Hyderabad”.*Buyers see the new name too/);
    expect(screen.queryByLabelText(/New name for/)).toBeNull();
  });
  it('Enter saves, Escape and Cancel leave the name as it was', async () => {
    render(<CityRequestsAdmin initial={INITIAL} />);
    open('Jaipur Bani Park');
    fireEvent.keyDown(screen.getByLabelText('New name for Jaipur Bani Park'), { key: 'Escape' });
    expect(screen.queryByLabelText(/New name for/)).toBeNull(); expect(fetchMock).not.toHaveBeenCalled();
    open('Jaipur Bani Park');
    fireEvent.click(within(row('Bani Park')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/New name for/)).toBeNull();
    open('Jaipur Bani Park');
    fireEvent.change(screen.getByLabelText('New name for Jaipur Bani Park'), { target: { value: 'Bani Park Jaipur' } });
    fireEvent.keyDown(screen.getByLabelText('New name for Jaipur Bani Park'), { key: 'Enter' });
    await waitFor(() => expect(within(row('Bani Park Jaipur')).getByText('Confirmed')).toBeTruthy());
  });
  it('does not send a name that is too short or unchanged', async () => {
    render(<CityRequestsAdmin initial={INITIAL} />);
    open('Hyderabad Nampally');
    fireEvent.change(screen.getByLabelText('New name for Hyderabad Nampally'), { target: { value: 'H' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name for Hyderabad Nampally' }));
    expect(screen.getByRole('alert').textContent).toMatch(/at least 2 letters/);
    fireEvent.change(screen.getByLabelText('New name for Hyderabad Nampally'), { target: { value: 'Hyderabad Nampally' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name for Hyderabad Nampally' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/New name for/)).toBeNull();
  });
  it('shows the reason and keeps the box open when saving fails', async () => {
    fail = 'Something broke.';
    render(<CityRequestsAdmin initial={INITIAL} />);
    open('Hyderabad Nampally');
    fireEvent.change(screen.getByLabelText('New name for Hyderabad Nampally'), { target: { value: 'Nampally Hyderabad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name for Hyderabad Nampally' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Something broke/));
    expect(screen.getByLabelText('New name for Hyderabad Nampally')).toBeTruthy();
  });
});
