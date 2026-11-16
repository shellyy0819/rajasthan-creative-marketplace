// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CityInput } from '@/components/CityInput';

const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
const FOUND = [{ label: 'Nampally, Telangana', name: 'Nampally', state: 'Telangana', ref: 'REF-NAMPALLY' }];
const ADDED = { label: 'Hyderabad Nampally, Telangana', name: 'Hyderabad Nampally', state: 'Telangana', ref: 'REF-ADDED' };
let fetchMock: ReturnType<typeof vi.fn>;
let postResult: { status: number; body: unknown };
const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

beforeEach(() => {
  postResult = { status: 201, body: { place: ADDED, alreadyThere: false } };
  onSubmit.mockClear();
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/places?')) return res(200, new URL(url, 'http://x').searchParams.get('q') === 'nampally' ? FOUND : []);
    if (url === '/api/city-requests' && init?.method === 'POST') return res(postResult.status, postResult.body);
    return res(500, { error: 'unexpected ' + url });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = (allowRequest = true) => render(<form onSubmit={onSubmit}><label><span>City</span><CityInput required allowRequest={allowRequest} /></label><button type="submit">Save</button></form>);
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Cannot find your city? Add it' }));
const search = (q: string) => fireEvent.change(screen.getByLabelText('Find the place'), { target: { value: q } });
const pickNampally = async () => { open(); search('nampally'); fireEvent.click(await screen.findByRole('button', { name: 'Nampally, Telangana' })); };

describe('CityInput: Cannot find your city? Add it', () => {
  it('is offered only where it is turned on (the seller\'s product form)', () => {
    mount(false);
    expect(screen.queryByRole('button', { name: 'Cannot find your city? Add it' })).toBeNull();
    cleanup(); mount(true);
    expect(screen.getByRole('button', { name: 'Cannot find your city? Add it' })).toBeTruthy();
  });
  it('searches any kind of place, picks one and offers its name to edit', async () => {
    mount(); await pickNampally();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/places?q=nampally&type=request');
    expect((screen.getByLabelText('Name to show') as HTMLInputElement).value).toBe('Nampally');
    expect(screen.getByRole('note').textContent).toMatch(/It will show as just “Nampally”.*“Hyderabad Nampally”/);
  });
  it('adds it, makes it the chosen city straight away and says the team has been told', async () => {
    mount(); await pickNampally();
    fireEvent.change(screen.getByLabelText('Name to show'), { target: { value: 'Hyderabad Nampally' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Anything we should know/ }), { target: { value: 'My workshop is here.' } });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/“Hyderabad Nampally” is added and ready to use.*told the Craftofy team/));
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!;
    expect(JSON.parse(String(post[1].body))).toEqual({ ref: 'REF-NAMPALLY', name: 'Hyderabad Nampally', note: 'My workshop is here.' });
    expect((document.querySelector('input[name="city"]') as HTMLInputElement).value).toBe('Hyderabad Nampally, Telangana');
    expect((document.querySelector('input[name="cityRef"]') as HTMLInputElement).value).toBe('REF-ADDED');
    expect(screen.queryByRole('group', { name: 'Add a city' })).toBeNull();   // the panel closed
    expect((document.querySelector('input[name="city"]') as HTMLInputElement).checkValidity()).toBe(true);
  });
  it('shows the reason and stays open when it cannot be added', async () => {
    postResult = { status: 429, body: { error: 'You have added several places today. Please try again tomorrow, or write to us.' } };
    mount(); await pickNampally();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/several places today/);
    expect(screen.getByRole('group', { name: 'Add a city' })).toBeTruthy();
    expect(document.querySelector('input[name="cityRef"]')).toBeNull();
  });
  it('says so when nothing is found, and Cancel closes the panel without changing the city', async () => {
    mount(); open(); search('zzzz');
    expect((await screen.findByRole('alert')).textContent).toMatch(/No place found/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Add a city' })).toBeNull();
    expect((document.querySelector('input[name="city"]') as HTMLInputElement).value).toBe('');
  });
  it('pressing Enter inside the panel never submits the product form around it', async () => {
    mount(); open();
    const search_ = screen.getByLabelText('Find the place');
    expect(fireEvent.keyDown(search_, { key: 'Enter' })).toBe(false);   // preventDefault was called
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!); expect(onSubmit).toHaveBeenCalledTimes(1);   // the form itself still submits normally
  });
});
