// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: ({ product }: any) => <button>contact {product.id}</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => null }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: ({ workshop }: any) => <button>reserve {workshop.id}</button> }));

import { LiveCatalog } from '@/components/LiveCatalog';

const prod = (id: string, name: string, city = 'Jaipur') => ({ id, name, category: 'Pottery', city, cityId: 1, citySlug: city.toLowerCase(), pricePaise: 10000, seller: 'S', description: 'd', stock: 3, status: 'APPROVED' });
const ws = (id: string, title: string) => ({ id, title, type: 'FREE', pricePaise: 0, city: 'Jodhpur', cityId: 1, citySlug: 'jodhpur', venue: 'V', date: '2026-11-22', time: '10:30', seats: 20, booked: 6, host: 'H', description: 'd', status: 'APPROVED' });

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (data: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/shop');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('LiveCatalog (products)', () => {
  const initial = [prod('p1', 'Initial Bowl'), prod('p2', 'Second Dish')];
  const mount = () => render(<LiveCatalog kind="products" initialItems={initial as any} initialValues={{}} />);

  it('renders server-provided items and does not fetch on mount', async () => {
    mount();
    expect(screen.getByText('Initial Bowl')).toBeTruthy();
    await flush(1000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('selecting a city fetches immediately and shows API results', async () => {
    fetchMock.mockReturnValue(reply([prod('p3', 'Jaipur Only')]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Jaipur' } });
    await flush(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?city=Jaipur');
    expect(screen.getByText('Jaipur Only')).toBeTruthy();
    expect(screen.queryByText('Initial Bowl')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/1 find /);
  });

  it('category and city combine; clearing a select drops its param', async () => {
    fetchMock.mockImplementation(() => reply([]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Jaipur' } });
    await flush(0);
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Pottery' } });
    await flush(0);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/products?city=Jaipur&category=Pottery');
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: '' } });
    await flush(0);
    expect(fetchMock.mock.calls[2][0]).toBe('/api/products?category=Pottery');
  });

  it('debounces search: rapid typing produces one request after 300ms', async () => {
    fetchMock.mockReturnValue(reply([prod('p9', 'Blue Thing')]));
    mount();
    const input = screen.getByLabelText('Search products');
    for (const v of ['b', 'bl', 'blu', 'blue']) {
      fireEvent.change(input, { target: { value: v } });
      await flush(100);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    await flush(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?q=blue');
    expect(screen.getByText('Blue Thing')).toBeTruthy();
  });

  it('trims search and skips the request when the effective filters did not change', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: '   ' } });
    await flush(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a stale slow response never overwrites a newer one', async () => {
    let resolveSlow!: (v: unknown) => void;
    const slow = new Promise(r => { resolveSlow = r; });
    fetchMock
      .mockImplementationOnce((_u: string, o: { signal: AbortSignal }) => new Promise((res, rej) => {
        o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        slow.then(() => res({ ok: true, json: () => Promise.resolve([prod('old', 'STALE RESULT')]) }));
      }))
      .mockImplementationOnce(() => reply([prod('new', 'FRESH RESULT')]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Jaipur' } });
    await flush(0);
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Udaipur' } });
    await flush(0);
    resolveSlow(null);
    await flush(0);
    expect(screen.getByText('FRESH RESULT')).toBeTruthy();
    expect(screen.queryByText('STALE RESULT')).toBeNull();
  });

  it('keeps previous results and shows an error when the API fails', async () => {
    fetchMock.mockReturnValue(reply({ error: 'boom' }, false));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Jaipur' } });
    await flush(0);
    expect(screen.getByRole('alert').textContent).toMatch(/boom/);
    expect(screen.getByText('Initial Bowl')).toBeTruthy();
  });

  it('shows the empty state for zero results', async () => {
    fetchMock.mockReturnValue(reply([]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Jodhpur' } });
    await flush(0);
    expect(screen.getByText(/No finds match/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/0 finds /);
  });

  it('updates the URL so the filtered view is shareable', async () => {
    fetchMock.mockReturnValue(reply([]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Jaipur' } });
    await flush(0);
    expect(window.location.pathname + window.location.search).toBe('/shop?city=Jaipur');
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: '' } });
    await flush(0);
    expect(window.location.pathname + window.location.search).toBe('/shop');
  });

  it('Clear resets all filters and refetches', async () => {
    fetchMock.mockReturnValue(reply(initial));
    render(<LiveCatalog kind="products" initialItems={initial as any} initialValues={{ city: 'Jaipur', q: 'x' }} />);
    fireEvent.click(screen.getByText('Clear'));
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products');
  });
});

describe('LiveCatalog (workshops)', () => {
  it('uses /api/workshops and the type param', async () => {
    fetchMock.mockReturnValue(reply([ws('w3', 'Sunday Meetup')]));
    render(<LiveCatalog kind="workshops" initialItems={[ws('w1', 'Old') as any]} initialValues={{}} />);
    fireEvent.change(screen.getByLabelText('Filter by price'), { target: { value: 'FREE' } });
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/workshops?type=FREE');
    expect(screen.getByText('Sunday Meetup')).toBeTruthy();
  });
});

describe('loader', () => {
  it('shows a non-blocking centred loader while results are being fetched and removes it afterwards', async () => {
    let release!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { release = r; }));
    render(<LiveCatalog kind="products" initialItems={[prod('p1', 'Alpha')]} initialValues={{}} />);
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'Jaipur' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const l = document.querySelector('.rr-page-loader')!;
    expect(l).toBeTruthy();
    expect(l.className).not.toContain('blocking');
    await act(async () => { release({ ok: true, json: () => Promise.resolve([prod('p2', 'Beta')]) } as Response); await vi.advanceTimersByTimeAsync(10); });
    expect(document.querySelector('.rr-page-loader')).toBeNull();
  });
});
