// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: ({ product }: any) => <button>contact {product.id}</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => null }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: ({ workshop }: any) => <button>reserve {workshop.id}</button> }));

import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { LiveCatalog } from '@/components/LiveCatalog';

// A fresh client per render, with retries off so a failed request surfaces at once.
const renderCat = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const prod = (id: string, name: string, city = 'Jaipur') => ({ id, name, category: 'Pottery', city, cityId: 1, citySlug: city.toLowerCase(), pricePaise: 10000, seller: 'S', description: 'd', stock: 3, status: 'APPROVED' });
const ws = (id: string, title: string) => ({ id, title, type: 'FREE', pricePaise: 0, city: 'Jodhpur', cityId: 1, citySlug: 'jodhpur', venue: 'V', date: '2026-11-22', time: '10:30', seats: 20, booked: 6, host: 'H', description: 'd', status: 'APPROVED' });

const CITIES = [{ name: 'Jaipur', slug: 'jaipur' }, { name: 'Jodhpur', slug: 'jodhpur' }, { name: 'Udaipur', slug: 'udaipur' }];
let fetchMock: ReturnType<typeof vi.fn>;
const reply = (data: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);

beforeEach(() => {
  vi.useFakeTimers();
  notifyManager.setScheduler(cb => cb()); // deliver query updates synchronously so fake timers are enough
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/shop');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('LiveCatalog (products)', () => {
  const initial = [prod('p1', 'Initial Bowl'), prod('p2', 'Second Dish')];
  const mount = () => renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={initial as any} initialValues={{}} />);

  it('renders server-provided items and does not fetch on mount', async () => {
    mount();
    expect(screen.getByText('Initial Bowl')).toBeTruthy();
    await flush(1000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('selecting a city fetches immediately and shows API results', async () => {
    fetchMock.mockReturnValue(reply([prod('p3', 'Jaipur Only')]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await flush(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?city=jaipur');
    expect(screen.getByText('Jaipur Only')).toBeTruthy();
    expect(screen.queryByText('Initial Bowl')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/1 find /);
  });

  it('category and city combine; clearing a select drops its param', async () => {
    fetchMock.mockImplementation(() => reply([]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await flush(0);
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Pottery' } });
    await flush(0);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/products?city=jaipur&category=Pottery');
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
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await flush(0);
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'udaipur' } });
    await flush(0);
    resolveSlow(null);
    await flush(0);
    expect(screen.getByText('FRESH RESULT')).toBeTruthy();
    expect(screen.queryByText('STALE RESULT')).toBeNull();
  });

  it('keeps previous results and shows an error when the API fails', async () => {
    fetchMock.mockReturnValue(reply({ error: 'boom' }, false));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await flush(0);
    expect(screen.getByRole('alert').textContent).toMatch(/boom/);
    expect(screen.getByText('Initial Bowl')).toBeTruthy();
  });

  it('shows the empty state for zero results', async () => {
    fetchMock.mockReturnValue(reply([]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jodhpur' } });
    await flush(0);
    expect(screen.getByText(/No finds match/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/0 finds /);
  });

  it('updates the URL so the filtered view is shareable', async () => {
    fetchMock.mockReturnValue(reply([]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await flush(0);
    expect(window.location.pathname + window.location.search).toBe('/shop?city=jaipur');
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: '' } });
    await flush(0);
    expect(window.location.pathname + window.location.search).toBe('/shop');
  });

  it('Clear resets all filters and refetches', async () => {
    fetchMock.mockReturnValue(reply(initial));
    renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={initial as any} initialValues={{ city: 'Jaipur', q: 'x' }} />);
    fireEvent.click(screen.getByText('Clear'));
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products');
  });
});

describe('LiveCatalog city filter', () => {
  it('LiveCatalog lists the cities it is given', () => {
    renderCat(<LiveCatalog cities={[{ name: 'Kota', slug: 'kota' }, { name: 'Pune', slug: 'pune' }]} kind="products" initialItems={[]} initialValues={{}} />);
    const sel = screen.getByLabelText('Filter by city') as HTMLSelectElement;
    expect(Array.from(sel.options).map(o => [o.value, o.textContent])).toEqual([['', 'All'], ['kota', 'Kota'], ['pune', 'Pune']]);
    cleanup();
    renderCat(<LiveCatalog cities={[{ name: 'Kota', slug: 'kota' }]} kind="workshops" initialItems={[]} initialValues={{}} />);
    expect(Array.from((screen.getByLabelText('Filter by city') as HTMLSelectElement).options).map(o => o.textContent)).toEqual(['All', 'Kota']);
  });
  it('a filter value given by slug selects the matching city instead of falling back to All', () => {
    renderCat(<LiveCatalog cities={[{ name: 'Kota', slug: 'kota' }]} kind="products" initialItems={[]} initialValues={{ city: 'kota' }} />);
    const sel = screen.getByLabelText('Filter by city') as HTMLSelectElement;
    expect(sel.options[sel.selectedIndex].textContent).toBe('Kota');
  });
  it('an old ?city=Kota (name) link selects the same city as ?city=kota', () => {
    renderCat(<LiveCatalog cities={[{ name: 'Kota', slug: 'kota' }]} kind="products" initialItems={[]} initialValues={{ city: 'Kota' }} />);
    const sel = screen.getByLabelText('Filter by city') as HTMLSelectElement;
    expect(sel.value).toBe('kota');
    expect(sel.options[sel.selectedIndex].textContent).toBe('Kota');
  });
  it('two cities sharing a name are told apart by state, and each sends its own slug', async () => {
    const two = [{ name: 'Jaipur', slug: 'jaipur', state: 'Rajasthan' }, { name: 'Udaipur', slug: 'udaipur', state: 'Rajasthan' }, { name: 'Udaipur', slug: 'udaipur-tripura', state: 'Tripura' }];
    fetchMock.mockReturnValue(reply([]));
    renderCat(<LiveCatalog cities={two} kind="products" initialItems={[]} initialValues={{}} />);
    const sel = screen.getByLabelText('Filter by city') as HTMLSelectElement;
    expect(Array.from(sel.options).map(o => [o.value, o.textContent])).toEqual([
      ['', 'All'], ['jaipur', 'Jaipur'], ['udaipur', 'Udaipur, Rajasthan'], ['udaipur-tripura', 'Udaipur, Tripura'],
    ]);
    fireEvent.change(sel, { target: { value: 'udaipur-tripura' } });
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?city=udaipur-tripura');
    expect((screen.getByLabelText('Filter by city') as HTMLSelectElement).value).toBe('udaipur-tripura');
    expect(screen.getByRole('status').textContent).toMatch(/in Udaipur, Tripura/);
  });
  it('an unknown filter value stays visible as its own option', () => {
    renderCat(<LiveCatalog cities={[{ name: 'Kota', slug: 'kota' }]} kind="products" initialItems={[]} initialValues={{ city: 'Atlantis' }} />);
    const sel = screen.getByLabelText('Filter by city') as HTMLSelectElement;
    expect(sel.value).toBe('Atlantis');
  });
});

describe('LiveCatalog (workshops)', () => {
  it('uses /api/workshops and the type param', async () => {
    fetchMock.mockReturnValue(reply([ws('w3', 'Sunday Meetup')]));
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as any]} initialValues={{}} />);
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
    renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={[prod('p1', 'Alpha')]} initialValues={{}} />);
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const l = document.querySelector('.rr-page-loader')!;
    expect(l).toBeTruthy();
    expect(l.className).not.toContain('blocking');
    await act(async () => { release({ ok: true, json: () => Promise.resolve([prod('p2', 'Beta')]) } as Response); await vi.advanceTimersByTimeAsync(10); });
    expect(document.querySelector('.rr-page-loader')).toBeNull();
  });
});
