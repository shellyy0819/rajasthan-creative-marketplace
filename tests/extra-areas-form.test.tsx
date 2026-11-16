// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ExtraAreasForm } from '@/components/ExtraAreasForm';
import type { ExtraArea } from '@/lib/extra-areas-shared';

const SHAIKPET: ExtraArea = { name: 'Hyderabad Shaikpet', state: 'Telangana', aliases: ['Shaikpet'], osmType: 'N', osmId: 2935018020, lat: 17.4, lng: 78.4 };
const BANI: ExtraArea = { name: 'Jaipur Bani Park', state: 'Rajasthan', aliases: [], osmType: 'N', osmId: 77, lat: 26.9, lng: 75.8 };
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let fetchMock: ReturnType<typeof vi.fn>;
let saved: ExtraArea[];
let failNext: { status: number; error: string } | null;

beforeEach(() => {
  saved = [SHAIKPET]; failNext = null;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (failNext) { const f = failNext; failNext = null; return res(f.status, { error: f.error }); }
    if (url.startsWith('/api/admin/settings/areas/search?')) return res(200, new URL(url, 'http://x').searchParams.get('q') === 'bani' ? [{ label: 'Bani Park, Jaipur, Rajasthan', name: 'Bani Park', state: 'Rajasthan', ref: 'REF-BANI' }] : []);
    if (url === '/api/admin/settings/areas' && method === 'POST') { const b = JSON.parse(String(init!.body)); saved = [...saved, { ...BANI, name: b.name }]; return res(200, { areas: saved }); }
    if (url === '/api/admin/settings/areas' && method === 'DELETE') { const b = JSON.parse(String(init!.body)); saved = saved.filter(a => a.osmId !== b.osmId); return res(200, { areas: saved }); }
    return res(500, { error: 'unexpected ' + method + ' ' + url });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const search = (q: string) => fireEvent.change(screen.getByLabelText(/Find an area/), { target: { value: q } });
const saved_ = () => screen.getByRole('heading', { name: 'In the City field now' }).parentElement!;

describe('ExtraAreasForm', () => {
  it('lists the saved areas with a Remove button each', () => {
    render(<ExtraAreasForm initial={[SHAIKPET, BANI]} />);
    expect(within(saved_()).getByText('Hyderabad Shaikpet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Jaipur Bani Park' })).toBeTruthy();
  });
  it('says so when the list is empty', () => {
    render(<ExtraAreasForm initial={[]} />);
    expect(screen.getByText('No extra areas yet.')).toBeTruthy();
  });
  it('searches after typing stops, shows the matches, and does not search for a single letter', async () => {
    render(<ExtraAreasForm initial={[]} />);
    search('b'); await new Promise(r => setTimeout(r, 450));
    expect(fetchMock).not.toHaveBeenCalled();
    search('bani');
    expect(await screen.findByRole('button', { name: 'Bani Park, Jaipur, Rajasthan' })).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/settings/areas/search?q=bani');
  });
  it('picks a result, offers its name to edit, adds it under the edited name and says it is in the City field', async () => {
    render(<ExtraAreasForm initial={[SHAIKPET]} />);
    search('bani');
    fireEvent.click(await screen.findByRole('button', { name: 'Bani Park, Jaipur, Rajasthan' }));
    const name = screen.getByLabelText(/Name sellers will see/) as HTMLInputElement;
    expect(name.value).toBe('Bani Park');
    fireEvent.change(name, { target: { value: 'Jaipur Bani Park' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/“Jaipur Bani Park” added.*City field/));
    const call = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!;
    expect(JSON.parse(String(call[1].body))).toEqual({ ref: 'REF-BANI', name: 'Jaipur Bani Park' });
    expect(within(saved_()).getByText('Jaipur Bani Park')).toBeTruthy();
    expect(screen.getByLabelText(/Find an area/)).toBeTruthy();   // ready for the next one
  });
  it('warns, without blocking, while the name is still just the area\'s own name, and stops once the city is added', async () => {
    render(<ExtraAreasForm initial={[]} />);
    search('bani');
    fireEvent.click(await screen.findByRole('button', { name: 'Bani Park, Jaipur, Rajasthan' }));
    expect(screen.getByRole('note').textContent).toMatch(/Sellers will see just “Bani Park”, with no city.*“Hyderabad Bani Park”/);
    fireEvent.change(screen.getByLabelText(/Name sellers will see/), { target: { value: 'Jaipur Bani Park' } });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Name sellers will see/), { target: { value: 'bani park' } });   // same name in other letters: still no city
    expect(screen.getByRole('note')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));   // the warning does not stop an admin who wants it as it is
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(true));
  });
  it('asks for a name before adding', async () => {
    render(<ExtraAreasForm initial={[]} />);
    search('bani');
    fireEvent.click(await screen.findByRole('button', { name: 'Bani Park, Jaipur, Rajasthan' }));
    fireEvent.change(screen.getByLabelText(/Name sellers will see/), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert').textContent).toMatch(/at least 2 letters/);
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'POST')).toBe(false);
  });
  it('lets you choose another result', async () => {
    render(<ExtraAreasForm initial={[]} />);
    search('bani');
    fireEvent.click(await screen.findByRole('button', { name: 'Bani Park, Jaipur, Rajasthan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose another' }));
    expect(screen.getByLabelText(/Find an area/)).toBeTruthy();
  });
  it('removes an area and says that cities already made from it stay', async () => {
    render(<ExtraAreasForm initial={[SHAIKPET]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hyderabad Shaikpet' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Removed “Hyderabad Shaikpet”.*already created from it stay/));
    expect(screen.getByText('No extra areas yet.')).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls.find(c => c[1]?.method === 'DELETE')![1].body))).toEqual({ osmType: 'N', osmId: 2935018020 });
  });
  it('shows an error toast and keeps the list when adding or removing fails', async () => {
    render(<ExtraAreasForm initial={[SHAIKPET]} />);
    failNext = { status: 500, error: 'Something broke.' };
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hyderabad Shaikpet' }));
    await waitFor(() => expect(screen.getAllByRole('alert').map(a => a.textContent).join(' ')).toMatch(/Something broke/));
    expect(within(saved_()).getByText('Hyderabad Shaikpet')).toBeTruthy();
  });
  it('says so when nothing matches or the search fails', async () => {
    render(<ExtraAreasForm initial={[]} />);
    search('zzzz');
    expect((await screen.findByRole('alert')).textContent).toMatch(/No suburbs or neighbourhoods found/);
    failNext = { status: 502, error: 'Place search is unavailable.' };
    search('yyyy');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Place search is unavailable/));
  });
});
