// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { PlaceInput } from '@/components/PlaceInput';

const UDAI = [{ label: 'Udaipur, Rajasthan', name: 'Udaipur', state: 'Rajasthan' }, { label: 'Udaipur City, Udaipur, Rajasthan', name: 'Udaipur City', state: 'Rajasthan' }];
let fetchMock: ReturnType<typeof vi.fn>;
let respond: (q: string) => { ok: boolean; status: number; body: unknown } | Promise<never>;

beforeEach(() => {
  vi.useFakeTimers();
  respond = q => ({ ok: true, status: 200, body: q.toLowerCase().startsWith('udai') ? UDAI : [] });
  fetchMock = vi.fn(async (url: string) => {
    const r = await respond(new URL(url, 'http://x').searchParams.get('q') ?? '');
    return { ok: r.ok, status: r.status, json: () => Promise.resolve(r.body) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const mount = (props: Partial<React.ComponentProps<typeof PlaceInput>> = {}) => render(<form><label>Pickup location<PlaceInput name="pickupLocation" {...props} /></label></form>);
const box = () => screen.getByRole('combobox') as HTMLInputElement;
const type = async (v: string, wait = 350) => { fireEvent.change(box(), { target: { value: v } }); await act(async () => { await vi.advanceTimersByTimeAsync(wait); }); };

describe('PlaceInput', () => {
  it('is a labelled combobox that keeps its form name and default value', () => {
    mount({ defaultValue: 'Behind the temple' });
    expect(box().name).toBe('pickupLocation');
    expect(box().value).toBe('Behind the temple');
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(box().getAttribute('aria-autocomplete')).toBe('list');
  });
  it('waits for the typing to pause (debounce) and for 3 characters before asking', async () => {
    mount();
    await type('ud');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: 'udai' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: 'udaip' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/places?q=udaip');
  });
  it('shows suggestions like "Udaipur, Rajasthan" as options and the OpenStreetMap credit', async () => {
    mount();
    await type('udai');
    const opts = screen.getAllByRole('option');
    expect(opts.map(o => o.textContent)).toEqual(['Udaipur, Rajasthan', 'Udaipur City, Udaipur, Rajasthan']);
    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/OpenStreetMap/)).toBeTruthy();
  });
  it('clicking a suggestion fills the field, closes the list and does not search again', async () => {
    mount();
    await type('udai');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Udaipur, Rajasthan' }));
    expect(box().value).toBe('Udaipur, Rajasthan');
    expect(screen.queryByRole('listbox')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('keyboard: arrows move, Enter picks, Escape closes the list without closing a parent dialog', async () => {
    const onEsc = vi.fn();
    const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') onEsc(); };
    document.addEventListener('keydown', listener);
    mount();
    await type('udai');
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    expect(box().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id);
    fireEvent.keyDown(box(), { key: 'ArrowUp' });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(box().value).toBe('Udaipur, Rajasthan');
    await type('udaipur c');
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onEsc).not.toHaveBeenCalled(); // Escape was consumed by the list
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(onEsc).toHaveBeenCalledTimes(1);   // with the list closed it reaches the dialog again
    document.removeEventListener('keydown', listener);
  });
  it('Enter with no highlighted suggestion is left alone so the form can submit', async () => {
    mount();
    await type('udai');
    const proceeded = fireEvent.keyDown(box(), { key: 'Enter' });
    expect(proceeded).toBe(true); // not default-prevented
    expect(box().value).toBe('udai');
  });
  it('free text is kept: typing something with no suggestions leaves it as typed', async () => {
    mount();
    await type('Behind Jagdish Temple, shelf 3');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box().value).toBe('Behind Jagdish Temple, shelf 3');
  });
  it('a failed search is silent: no list, the typed text stays, typing again retries', async () => {
    respond = () => ({ ok: false, status: 502, body: { error: 'Place search is unavailable.' } });
    mount();
    await type('udai');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box().value).toBe('udai');
    respond = q => ({ ok: true, status: 200, body: q.startsWith('udai') ? UDAI : [] });
    await type('udaip');
    expect(screen.getAllByRole('option').length).toBe(2);
  });
  it('an older, slower response never replaces a newer one (stale results are ignored and aborted)', async () => {
    let releaseFirst: (v: { ok: boolean; status: number; body: unknown }) => void = () => undefined;
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const q = new URL(url, 'http://x').searchParams.get('q');
      if (init?.signal) signals.push(init.signal);
      const r = q === 'udai' ? await new Promise<{ ok: boolean; status: number; body: unknown }>(res => { releaseFirst = res; }) : { ok: true, status: 200, body: [{ label: 'Jaipur, Rajasthan', name: 'Jaipur' }] };
      return { ok: r.ok, status: r.status, json: () => Promise.resolve(r.body) } as Response;
    });
    mount();
    await type('udai');
    await type('jaip');
    expect(signals[0].aborted).toBe(true);
    await act(async () => { releaseFirst({ ok: true, status: 200, body: UDAI }); await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Jaipur, Rajasthan']);
  });
  it('clearing the field hides the list; blur hides it too', async () => {
    mount();
    await type('udai');
    await type('');
    expect(screen.queryByRole('listbox')).toBeNull();
    await type('udai');
    fireEvent.blur(box());
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('respects maxLength', () => {
    mount({ maxLength: 200 });
    expect(box().maxLength).toBe(200);
  });
  it('shows a small spinner inside the field while suggestions are loading', async () => {
    let release!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { release = r; }));
    mount();
    fireEvent.change(box(), { target: { value: 'udai' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(document.querySelector('.place-field.busy')).toBeTruthy();
    expect(box().getAttribute('aria-busy')).toBe('true');
    await act(async () => { release({ ok: true, json: () => Promise.resolve(UDAI) } as Response); await vi.advanceTimersByTimeAsync(10); });
    expect(document.querySelector('.place-field.busy')).toBeNull();
  });
});
