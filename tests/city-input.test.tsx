// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { CityInput } from '@/components/CityInput';

const KOTA = [{ label: 'Kota, Rajasthan', name: 'Kota', state: 'Rajasthan', ref: 'REF-KOTA' }, { label: 'Kotdwar, Uttarakhand', name: 'Kotdwar', state: 'Uttarakhand', ref: 'REF-KOTDWAR' }];
const MESSAGE = 'City search is unavailable. Your current city is kept.';
let fetchMock: ReturnType<typeof vi.fn>;
let respond: (q: string) => { ok: boolean; status: number; body: unknown };
let submitted: ReturnType<typeof vi.fn<(d: Record<string, FormDataEntryValue>) => void>>;

beforeEach(() => {
  vi.useFakeTimers();
  respond = q => ({ ok: true, status: 200, body: q.toLowerCase().startsWith('kot') ? KOTA : [] });
  fetchMock = vi.fn(async (url: string) => {
    const r = respond(new URL(url, 'http://x').searchParams.get('q') ?? '');
    return { ok: r.ok, status: r.status, json: () => Promise.resolve(r.body) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  submitted = vi.fn<(d: Record<string, FormDataEntryValue>) => void>();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const mount = (props: Partial<React.ComponentProps<typeof CityInput>> = {}) => render(
  <form onSubmit={e => { e.preventDefault(); submitted(Object.fromEntries(new FormData(e.currentTarget))); }}>
    <label><span className="lbl">City</span><CityInput {...props} /></label>
    <button type="submit">Save</button>
  </form>,
);
const box = () => screen.getByRole('combobox') as HTMLInputElement;
const form = () => document.querySelector('form') as HTMLFormElement;
const data = () => Object.fromEntries(new FormData(form()));
const type = async (v: string, wait = 350) => { fireEvent.change(box(), { target: { value: v } }); await act(async () => { await vi.advanceTimersByTimeAsync(wait); }); };

describe('CityInput', () => {
  it('is a labelled combobox named "city" that searches cities only', async () => {
    mount();
    expect(box().name).toBe('city');
    expect(box().getAttribute('aria-autocomplete')).toBe('list');
    await type('kota');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/places?q=kota&type=city');
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Kota, Rajasthan', 'Kotdwar, Uttarakhand']);
  });

  it('CityInput submits cityRef only after a suggestion is chosen', async () => {
    mount({ required: true });
    await type('kota');
    expect(data()).not.toHaveProperty('cityRef');
    expect(data()).not.toHaveProperty('cityId');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    expect(box().value).toBe('Kota, Rajasthan');
    expect(data().cityRef).toBe('REF-KOTA');
    expect(data()).not.toHaveProperty('cityId');
    expect(form().checkValidity()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0][0]).toMatchObject({ cityRef: 'REF-KOTA' });
  });

  it('keyboard: arrows and Enter choose a suggestion like PlaceInput', async () => {
    mount({ required: true });
    await type('kot');
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    expect(box().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id);
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(box().value).toBe('Kotdwar, Uttarakhand');
    expect(data().cityRef).toBe('REF-KOTDWAR');
  });

  it('typing without choosing leaves the form invalid', async () => {
    mount({ required: true });
    expect(form().checkValidity()).toBe(false); // empty and required
    await type('Kota');
    fireEvent.blur(box());
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(box().value).toBe('Kota');
    expect(form().checkValidity()).toBe(false);
    expect(box().validationMessage).toMatch(/choose a city/i);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(data()).not.toHaveProperty('cityRef');
  });

  it('even when not required, free text without a chosen suggestion is invalid', async () => {
    mount();
    expect(form().checkValidity()).toBe(true); // empty optional field is fine
    await type('Somewhere I typed');
    expect(form().checkValidity()).toBe(false);
  });

  it('the untouched default submits its cityId and is valid', () => {
    mount({ required: true, defaultCity: { id: 7, label: 'Jaipur' } });
    expect(box().value).toBe('Jaipur');
    expect(data().cityId).toBe('7');
    expect(data()).not.toHaveProperty('cityRef');
    expect(form().checkValidity()).toBe(true);
  });

  it('editing the default drops cityId until a new suggestion is chosen; choosing replaces it with a cityRef', async () => {
    mount({ required: true, defaultCity: { id: 7, label: 'Jaipur' } });
    await type('kota');
    expect(data()).not.toHaveProperty('cityId');
    expect(form().checkValidity()).toBe(false);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    expect(data()).toMatchObject({ cityRef: 'REF-KOTA' });
    expect(data()).not.toHaveProperty('cityId');
  });

  it('clearing an optional city submits neither field (the city is removed)', async () => {
    mount({ defaultCity: { id: 7, label: 'Jaipur' } });
    await type('');
    expect(data()).not.toHaveProperty('cityId');
    expect(data()).not.toHaveProperty('cityRef');
    expect(form().checkValidity()).toBe(true);
  });

  it('a failed search keeps the previous city and shows the message', async () => {
    respond = () => ({ ok: false, status: 502, body: { error: 'Place search is unavailable.' } });
    mount({ required: true, defaultCity: { id: 7, label: 'Jaipur' } });
    await type('kota');
    expect(screen.getByRole('alert').textContent).toBe(MESSAGE);
    expect(box().value).toBe('Jaipur');
    expect(data().cityId).toBe('7');
    expect(form().checkValidity()).toBe(true);
    // a later successful search clears the message
    respond = q => ({ ok: true, status: 200, body: q.startsWith('kot') ? KOTA : [] });
    await type('kotd');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('option').length).toBe(2);
  });

  it('a failed search after choosing keeps the chosen city (cityRef), and a network error counts as a failure', async () => {
    mount({ required: true });
    await type('kota');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    await type('jaipur');
    expect(screen.getByRole('alert').textContent).toBe(MESSAGE);
    expect(box().value).toBe('Kota, Rajasthan');
    expect(data().cityRef).toBe('REF-KOTA');
  });

  it('a failed search with no previous city never accepts the typed text', async () => {
    respond = () => ({ ok: false, status: 502, body: {} });
    mount({ required: true });
    await type('kota');
    expect(screen.getByRole('alert').textContent).toBe(MESSAGE);
    expect(data()).not.toHaveProperty('cityRef');
    expect(form().checkValidity()).toBe(false);
  });

  it('required puts the native required attribute on the visible input', () => {
    mount({ required: true });
    expect(box().required).toBe(true);
    cleanup();
    mount();
    expect(box().required).toBe(false);
  });
});
