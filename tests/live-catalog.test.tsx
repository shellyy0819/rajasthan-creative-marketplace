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
import { DataVersionProvider } from '@/components/DataVersion';

// A fresh client per render, with retries off so a failed request surfaces at once.
const renderCat = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const prod = (id: string, name: string, city = 'Jaipur') => ({ id, name, category: 'Pottery', city, cityId: 1, citySlug: city.toLowerCase(), pricePaise: 10000, seller: 'S', description: 'd', stock: 3, status: 'APPROVED' });
const ws = (id: string, title: string) => ({ id, title, type: 'FREE', pricePaise: 0, city: 'Jodhpur', cityId: 1, citySlug: 'jodhpur', venue: 'V', date: '2026-11-22', time: '10:30', seats: 20, booked: 6, host: 'H', description: 'd', status: 'APPROVED', kind: 'workshop', mode: 'in_person', topicId: null, endsOn: null, platform: null, schedule: null, languages: [], level: null, experience: null, certifications: null, freeTrial: false, freeTrialDays: null, whatsapp: null, instagram: null, website: null, images: [], prices: [] });

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

describe('LiveCatalog count line', () => {
  it('the workshops list has no "N experiences" line, while the shop keeps its "finds to love" line', () => {
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as never]} initialValues={{}} />);
    expect(screen.queryByText(/experience/i)).toBeNull();
    expect(screen.queryByText(/around India/i)).toBeNull();
    cleanup();
    renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={[prod('p1', 'Pot') as never]} initialValues={{}} />);
    expect(screen.getByText(/1 find to love/i)).toBeTruthy();
  });
});

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
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?city=jaipur&limit=12&offset=0');
    expect(screen.getByText('Jaipur Only')).toBeTruthy();
    expect(screen.queryByText('Initial Bowl')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/1 find /);
  });

  it('offers a type filter when the shop has types, and sends the chosen one', async () => {
    fetchMock.mockReturnValue(reply([prod('p3', 'Curated Thing')]));
    renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={initial as any} initialValues={{}} sourcingTypes={['Handmade', 'Curated']} />);
    const select = screen.getByLabelText('Filter by type') as HTMLSelectElement;
    expect(Array.from(select.options).map(o => o.textContent)).toEqual(['All types', 'Handmade', 'Curated']);
    fireEvent.change(select, { target: { value: 'Curated' } });
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?source=Curated&limit=12&offset=0');
    expect(screen.getByText('Curated Thing')).toBeTruthy();
  });
  it('has no type filter when no types are offered', () => {
    mount();
    expect(screen.queryByLabelText('Filter by type')).toBeNull();
  });

  it('category and city combine; clearing a select drops its param', async () => {
    fetchMock.mockImplementation(() => reply([]));
    mount();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await flush(0);
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Pottery' } });
    await flush(0);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/products?city=jaipur&category=Pottery&limit=12&offset=0');
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: '' } });
    await flush(0);
    expect(fetchMock.mock.calls[2][0]).toBe('/api/products?category=Pottery&limit=12&offset=0');
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
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?q=blue&limit=12&offset=0');
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
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?limit=12&offset=0');
  });
});

describe('LiveCatalog (products) loads a page at a time', () => {
  const four = [prod('p1', 'One'), prod('p2', 'Two'), prod('p3', 'Three'), prod('p4', 'Four')];
  const withTotal = (data: unknown[], total: number) => Promise.resolve({ ok: true, json: () => Promise.resolve(data), headers: { get: (k: string) => (k === 'X-Total-Count' ? String(total) : null) } } as unknown as Response);
  const mountPaged = () => renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={four.slice(0, 2) as any} initialTotal={4} initialValues={{}} />);
  const titles = () => [...document.querySelectorAll('.product-card h3')].map(h => h.textContent);

  it('says how many finds there are in all, not how many are loaded', () => {
    mountPaged();
    expect(screen.getByRole('status').textContent).toMatch(/^4 finds /);
    expect(titles()).toEqual(['One', 'Two']);
  });
  it('Show more fetches the next page by position, appends it, then stops offering more', async () => {
    fetchMock.mockReturnValue(withTotal(four.slice(2), 4));
    mountPaged();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?limit=12&offset=2');
    expect(titles()).toEqual(['One', 'Two', 'Three', 'Four']);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/^4 finds /);
  });
  it('offers no Show more when the first page already holds everything', () => {
    renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={four.slice(0, 2) as any} initialTotal={2} initialValues={{}} />);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
  it('a new filter starts again from the first page, with its own total', async () => {
    fetchMock.mockReturnValue(withTotal([four[3]], 1));
    mountPaged();
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?city=jaipur&limit=12&offset=0');
    expect(titles()).toEqual(['Four']);
    expect(screen.getByRole('status').textContent).toMatch(/^1 find /);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});

describe('LiveCatalog cache follows the data version', () => {
  const initial = [prod('p1', 'Initial Bowl')];
  const shop = (client: QueryClient, version: string) => (
    <QueryClientProvider client={client}><DataVersionProvider version={version}><LiveCatalog cities={CITIES} kind="products" initialItems={initial as any} initialValues={{}} /></DataVersionProvider></QueryClientProvider>
  );
  const pick = (city: string) => fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: city } });
  const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

  it('reuses a search it already ran, even after leaving the page, while nothing was changed', async () => {
    fetchMock.mockReturnValue(reply([prod('p3', 'Jaipur Only')]));
    const client = newClient();
    render(shop(client, 'v1')); pick('jaipur'); await flush(0);
    cleanup();
    render(shop(client, 'v1')); pick('jaipur'); await flush(0);
    expect(screen.getByText('Jaipur Only')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('searches again once the server reports a new version', async () => {
    fetchMock.mockReturnValue(reply([prod('p3', 'Jaipur Only')]));
    const client = newClient();
    const { rerender } = render(shop(client, 'v1')); pick('jaipur'); await flush(0);
    rerender(shop(client, 'v2')); await flush(0);
    expect(client.getQueryCache().findAll({ queryKey: ['data'] }).every(q => q.queryKey[1] === 'v2')).toBe(true);
    await flush(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('LiveCatalog city filter', () => {
  it('LiveCatalog lists the cities it is given', () => {
    renderCat(<LiveCatalog cities={[{ name: 'Kota', slug: 'kota' }, { name: 'Pune', slug: 'pune' }]} kind="products" initialItems={[]} initialValues={{}} />);
    const sel = screen.getByLabelText('Filter by city') as HTMLSelectElement;
    expect(Array.from(sel.options).map(o => [o.value, o.textContent])).toEqual([['', 'All Cities'], ['kota', 'Kota'], ['pune', 'Pune']]);
    cleanup();
    renderCat(<LiveCatalog cities={[{ name: 'Kota', slug: 'kota' }]} kind="workshops" initialItems={[]} initialValues={{}} />);
    expect(Array.from((screen.getByLabelText('Filter by city') as HTMLSelectElement).options).map(o => o.textContent)).toEqual(['All Cities', 'Kota']);
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
      ['', 'All Cities'], ['jaipur', 'Jaipur'], ['udaipur', 'Udaipur, Rajasthan'], ['udaipur-tripura', 'Udaipur, Tripura'],
    ]);
    fireEvent.change(sel, { target: { value: 'udaipur-tripura' } });
    await flush(0);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?city=udaipur-tripura&limit=12&offset=0');
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

describe('LiveCatalog (workshops): open and ended', () => {
  const chipNames = () => [...document.querySelectorAll('.filter-chips .chip-x')].map(b => b.getAttribute('aria-label'));
  it('has a status menu (open and ended) on the workshops list only, sends it as ?status=, shows a chip and removes it', async () => {
    fetchMock.mockReturnValue(reply([ws('w3', 'Past pop-up')]));
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as any]} initialValues={{}} />);
    const menu = screen.getByLabelText('Filter by status') as HTMLSelectElement;
    expect([...menu.options].map(o => o.textContent)).toEqual(['Open & ended', 'Open', 'Ended']);
    fireEvent.change(menu, { target: { value: 'ended' } });
    await flush(0);
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/workshops?status=ended');
    expect(screen.getByText('Past pop-up')).toBeTruthy();
    expect(chipNames()).toEqual(['Remove Ended']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ended' }));
    await flush(0);
    expect(chipNames()).toEqual([]); // back to the unfiltered list the page handed over, so nothing more to fetch
    expect((screen.getByLabelText('Filter by status') as HTMLSelectElement).value).toBe('');
  });
  it('a link with ?status=open opens with the menu and chip already set; the shop has no status menu', () => {
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as any]} initialValues={{ status: 'open' }} />);
    expect((screen.getByLabelText('Filter by status') as HTMLSelectElement).value).toBe('open');
    expect(chipNames()).toEqual(['Remove Open']);
    cleanup();
    renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={[]} initialValues={{}} />);
    expect(screen.queryByLabelText('Filter by status')).toBeNull();
  });
});

describe('loader', () => {
  const pending = async (kind: 'products' | 'workshops') => {
    let release!: (v: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { release = r; }));
    renderCat(kind === 'products'
      ? <LiveCatalog cities={CITIES} kind="products" initialItems={[prod('p1', 'Alpha')]} initialValues={{}} />
      : <LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Sunday Meetup') as never]} initialValues={{}} />);
    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    return release;
  };
  it('the shop shows no centred spinner while results are fetched, but dims the old results', async () => {
    const release = await pending('products');
    expect(document.querySelector('.rr-page-loader')).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    await act(async () => { release({ ok: true, json: () => Promise.resolve([prod('p2', 'Beta')]) } as Response); await vi.advanceTimersByTimeAsync(10); });
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
  it('workshops show no spinner while results are fetched: the old list stays and is dimmed, then the new one replaces it', async () => {
    const release = await pending('workshops');
    expect(document.querySelector('.rr-page-loader')).toBeNull();
    const busy = document.querySelector('[aria-busy="true"]') as HTMLElement;
    expect(busy).toBeTruthy();
    expect(busy.style.opacity).toBe('0.6');
    expect(document.body.textContent).toContain('Sunday Meetup'); // the previous results are still on screen
    await act(async () => { release({ ok: true, json: () => Promise.resolve([ws('w2', 'Other')]) } as Response); await vi.advanceTimersByTimeAsync(10); });
    expect(document.querySelector('.rr-page-loader')).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(document.body.textContent).toContain('Other');
  });
});

describe('LiveCatalog filter chips', () => {
  const chipNames = () => [...document.querySelectorAll('.filter-chips .chip-x')].map(b => b.getAttribute('aria-label'));
  it('shows no chips and no Clear all while no filter is in use', () => {
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as never]} initialValues={{}} />);
    expect(document.querySelector('.filter-chips')).toBeNull();
    expect(screen.queryByText('Clear all')).toBeNull();
  });
  it('shows each workshop filter in use as a chip: search text, city, price and format', () => {
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as never]} initialValues={{ q: 'udaipur', city: 'jaipur', type: 'FREE', mode: 'in_person' }} />);
    expect(chipNames()).toEqual(['Remove Search: udaipur', 'Remove Jaipur', 'Remove Free', 'Remove In person']);
    expect(screen.getByRole('group', { name: 'Filters in use' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeTruthy();
  });
  it('shows the shop filters as chips too: city, category and type', () => {
    renderCat(<LiveCatalog cities={CITIES} kind="products" initialItems={[prod('p1', 'Pot') as never]} initialValues={{ city: 'jodhpur', category: 'Pottery', source: 'Handmade' }} sourcingTypes={['Handmade']} />);
    expect(chipNames()).toEqual(['Remove Jodhpur', 'Remove Pottery', 'Remove Handmade']);
  });
  it('a chip that says Paid or Online uses plain words, not the codes', () => {
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as never]} initialValues={{ type: 'PAID', mode: 'online' }} />);
    expect(chipNames()).toEqual(['Remove Paid', 'Remove Online']);
  });
  it('removing a chip drops just that filter, clears its menu and refetches without it', async () => {
    fetchMock.mockReturnValue(reply([ws('w2', 'Other')]));
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as never]} initialValues={{ city: 'jaipur', type: 'FREE' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Jaipur' }));
    await flush(0);
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/workshops?type=FREE');
    expect((screen.getByLabelText('Filter by city') as HTMLSelectElement).value).toBe('');
    expect(chipNames()).toEqual(['Remove Free']);
  });
  it('Clear all removes every chip and refetches the full list, and the old Clear button is gone from the filter row', async () => {
    fetchMock.mockReturnValue(reply([ws('w2', 'Other')]));
    renderCat(<LiveCatalog cities={CITIES} kind="workshops" initialItems={[ws('w1', 'Old') as never]} initialValues={{ city: 'jaipur', q: 'x' }} />);
    expect(document.querySelector('form.filters')!.textContent).not.toContain('Clear');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await flush(0);
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/workshops');
    expect(document.querySelector('.filter-chips')).toBeNull();
  });
  it('the chips are the shared removable chip, which the language picker uses too (source contract)', async () => {
    const fs = await import('node:fs');
    expect(fs.readFileSync('src/components/LiveCatalog.tsx', 'utf8')).toContain("RemovableChip");
    expect(fs.readFileSync('src/components/LanguageSelect.tsx', 'utf8')).toContain("RemovableChip");
    expect(fs.readFileSync('src/components/RemovableChip.css', 'utf8')).toMatch(/\.chip-x \{[^}]*border-radius: 30px;/);
    expect(fs.readFileSync('src/components/LiveCatalog.tsx', 'utf8')).toContain('className="text-link" onClick={() => { setDelay(0); setValues({}); }}>Clear all');
    expect(fs.readFileSync('src/app/globals.css', 'utf8').replace(/\s+/g, ' ')).toMatch(/\.filter-chips \.text-link \{[^}]*background: none;[^}]*text-decoration: underline;/); // Clear all is plain underlined text with no background
  });
});

describe('the workshop list band spacing (source contract)', () => {
  it('has the same space above the band\'s edge and below it to the search row, on laptops and phones', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync('src/components/WorkshopListings.css', 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.workshop-band\.ws-list-band \{ display: block; margin-top: 18px; padding-top: 36px;/);
    expect(css).toMatch(/\.workshop-band\.ws-list-band \.filters \{ margin-top: 0;/);
    expect(css).toMatch(/@media \(max-width: 700px\) \{ \.workshop-band\.ws-list-band \{ margin-top: 20px; padding-top: 20px;/);
  });
});
