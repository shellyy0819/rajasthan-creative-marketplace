// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MarketTrendsAdmin, type DigestDto, type SummaryDto } from '@/components/MarketTrendsAdmin';
import type { MatchedItem } from '@/lib/trend-match';
import type { TrendItem } from '@/lib/trend-types';

const gate = vi.hoisted(() => ({ requireAdminPage: vi.fn(async () => undefined) }));
const store = vi.hoisted(() => ({ listDigests: vi.fn(), getDigest: vi.fn(), matchItems: vi.fn(), getTrendSettings: vi.fn() }));
vi.mock('@/lib/admin-page', () => gate);
vi.mock('@/lib/trend-store', () => ({ listDigests: store.listDigests, getDigest: store.getDigest }));
vi.mock('@/lib/trend-match', () => ({ matchItems: store.matchItems }));
vi.mock('@/lib/trend-settings', () => ({ getTrendSettings: store.getTrendSettings }));
import MarketTrendsPage from '@/app/dashboard/market-trends/page';

const D1 = '24 November 2026';
const D2 = '17 November 2026';
const item = (id: string, over: Partial<TrendItem> = {}): TrendItem => ({
  id, kind: 'craft', title: `Item ${id}`, why: `Why ${id} is rising now.`, tags: [], origin: 'web', sources: [{ title: `Source of ${id}`, url: 'https://news.example.com/a' }], show: true, ...over,
});
const digest = (id: string, over: Partial<DigestDto> = {}): DigestDto => ({
  id, createdAt: '2026-11-24T08:35:00.000Z', createdBy: 'boss@x.co', model: 'm', status: 'ok', error: null, items: [], publishedAt: null, publishedBy: null, ...over,
});
const summary = (d: DigestDto): SummaryDto => { const { items, ...rest } = d; return { ...rest, itemCount: items.length, shownCount: items.filter(i => i.show).length }; };
const match = (items: TrendItem[], counts: Record<string, number> = {}): MatchedItem[] => items.map(i => ({ ...i, count: counts[i.id] ?? 0, href: '/shop' }));

const ITEMS = [
  item('a', { title: 'Block prints in natural dyes', kind: 'craft', category: 'Textiles', tags: ['block', 'dye'], sources: [{ title: 'Pinterest Trends', url: 'https://pinterest.example.com/t' }, { title: 'Our research' }] }),
  item('b', { title: 'Block printing for beginners', kind: 'workshop', why: 'People ask for beginner classes.', sources: [{ title: 'Craft Journal' }] }),
  item('c', { title: 'Miniature paintings as wall sets', kind: 'art', show: false, sources: [{ title: 'Studio Desk' }] }),
];
const D_DRAFT = digest('11111111-1111-4111-8111-111111111111', { items: ITEMS });
const D_PUB = digest('22222222-2222-4222-8222-222222222222', { createdAt: '2026-11-17T05:00:00.000Z', items: [item('p1', { title: 'Published thing' })], publishedAt: '2026-11-18T05:00:00.000Z', publishedBy: 'boss@x.co' });
const MATCHED = match(ITEMS, { a: 3, b: 1 });

const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
type Handler = (url: string, init: RequestInit | undefined) => Promise<Response> | null;
let routes: Handler[];
let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string, re: RegExp) => fetchMock.mock.calls.filter(([u, i]) => (i?.method ?? 'GET') === method && re.test(String(u)));
const body = (c: unknown[]) => JSON.parse(String((c[1] as RequestInit).body));

beforeEach(() => {
  routes = [];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    for (const h of routes) { const r = h(url, init); if (r) return r; }
    return res(500, { error: `unexpected ${init?.method ?? 'GET'} ${url}` });
  });
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/dashboard/market-trends');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function show(d: { digests?: DigestDto[]; selected?: DigestDto | null; matched?: MatchedItem[]; keySet?: boolean; publicOrigin?: string } = {}) {
  const digests = d.digests ?? [D_DRAFT, D_PUB];
  const selected = d.selected === undefined ? digests[0] ?? null : d.selected;
  return render(<MarketTrendsAdmin digests={digests.map(summary)} selected={selected} matched={d.matched ?? (selected ? match(selected.items, { a: 3, b: 1 }) : [])} keySet={d.keySet ?? true} publicOrigin={d.publicOrigin} />);
}
const card = (date: string) => screen.getByRole('article', { name: `Digest of ${date}` });
const row = (title: string) => screen.getAllByTestId('trend-item').find(r => within(r).queryByRole('heading', { name: title }))!;

describe('MarketTrendsAdmin: top bar', () => {
  it('with no key saved says so, links to Settings and disables Fetch trends', () => {
    show({ keySet: false });
    expect(screen.getByRole('link', { name: /Settings/ }).getAttribute('href')).toBe('/dashboard/settings');
    expect((screen.getByRole('button', { name: 'Fetch trends' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('with a key saved enables Fetch trends and shows no key note', () => {
    show();
    expect((screen.getByRole('button', { name: 'Fetch trends' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('link', { name: /Settings/ })).toBeNull();
  });
  it('says so when there are no digests, and offers no picker', () => {
    show({ digests: [], selected: null });
    expect(screen.getByText(/No digests yet/)).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Digest' })).toBeNull();
    expect(screen.queryByText('Check the items')).toBeNull();
  });
  it('Fetch trends is busy while the request runs, then adds the new digest, selects it and shows a toast', async () => {
    const fresh = digest('33333333-3333-4333-8333-333333333333', { createdAt: '2026-11-26T04:00:00.000Z', items: [item('n1', { title: 'Fresh trend', show: false })] });
    let release!: (r: Response) => void;
    routes.push((u, i) => (u === '/api/admin/trends' && i?.method === 'POST' ? new Promise<Response>(r => { release = r; }) : null));
    routes.push(u => (u === `/api/admin/trends/${fresh.id}` ? res(200, { digest: fresh, matched: match(fresh.items) }) : null));
    show();
    const btn = screen.getByRole('button', { name: 'Fetch trends' }) as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('true'));
    expect(btn.disabled).toBe(true);
    await act(async () => { release({ ok: true, status: 201, json: () => Promise.resolve(fresh) } as Response); });
    await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
    expect(screen.getByRole('status').textContent).toMatch(/Fetched 1 item\./);
    expect(card('26 November 2026')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fresh trend' })).toBeTruthy();
    expect(window.location.search).toBe(`?d=${fresh.id}`);
  });
  it('a failed fetch shows the error in a toast, clears the busy state and refreshes the list so the failed digest appears', async () => {
    const failed = digest('44444444-4444-4444-8444-444444444444', { createdAt: '2026-11-26T04:00:00.000Z', status: 'failed', error: 'The research service is down.' });
    routes.push((u, i) => (u === '/api/admin/trends' && i?.method === 'POST' ? res(502, { error: 'The research service is down.' }) : null));
    routes.push((u, i) => (u === '/api/admin/trends' && (i?.method ?? 'GET') === 'GET' ? res(200, { digests: [failed, D_DRAFT, D_PUB].map(summary) }) : null));
    show();
    const btn = screen.getByRole('button', { name: 'Fetch trends' }) as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/The research service is down\./));
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-busy')).not.toBe('true');
    await waitFor(() => expect(within(card('26 November 2026')).getByText('The research service is down.')).toBeTruthy());
  });
  it('shows an error toast on a network failure and keeps working', async () => {
    routes.push((u, i) => (u === '/api/admin/trends' && i?.method === 'POST' ? Promise.reject(new Error('offline')) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Fetch trends' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Network error/));
    expect((screen.getByRole('button', { name: 'Fetch trends' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('the digest picker lists every digest with its date and state, and switching loads that digest from the API and puts it in the URL', async () => {
    routes.push(u => (u === `/api/admin/trends/${D_PUB.id}` ? res(200, { digest: D_PUB, matched: match(D_PUB.items) }) : null));
    show();
    const pick = screen.getByRole('combobox', { name: 'Digest' }) as HTMLSelectElement;
    expect(within(pick).getAllByRole('option').map(o => o.textContent)).toEqual([`${D1}, 14:05 · Draft`, `${D2}, 10:30 · Published`]);
    fireEvent.change(pick, { target: { value: D_PUB.id } });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Published thing' })).toBeTruthy());
    expect(screen.queryByRole('heading', { name: 'Block prints in natural dyes' })).toBeNull();
    expect(window.location.search).toBe(`?d=${D_PUB.id}`);
  });
  it('a failed switch shows a toast and keeps the digest that was open', async () => {
    routes.push(u => (u === `/api/admin/trends/${D_PUB.id}` ? res(404, { error: 'Digest not found.' }) : null));
    show();
    fireEvent.change(screen.getByRole('combobox', { name: 'Digest' }), { target: { value: D_PUB.id } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Digest not found\./));
    expect(screen.getByRole('heading', { name: 'Block prints in natural dyes' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Digest' }) as HTMLSelectElement).value).toBe(D_DRAFT.id);
  });
});

describe('MarketTrendsAdmin: digest cards', () => {
  it('a draft shows the badge Draft, Preview on site and Publish for everyone, with the digest date in their names', () => {
    show();
    const c = card(D1);
    expect(within(c).getByText('Draft').className).toMatch(/badge draft/);
    expect(within(c).getByRole('button', { name: `Preview on site: ${D1} digest` }).textContent).toBe('Preview on site');
    expect(within(c).getByRole('button', { name: `Publish for everyone: ${D1} digest` }).textContent).toBe('Publish for everyone');
    expect(within(c).queryByRole('button', { name: /Unpublish/ })).toBeNull();
    expect(within(c).getByText(/^3 items, 2 shown\./)).toBeTruthy();
  });
  it('a published digest shows the badge Published and an Unpublish danger-outline button', () => {
    show();
    const c = card(D2);
    expect(within(c).getByText('Published').className).toMatch(/badge published/);
    const un = within(c).getByRole('button', { name: `Unpublish: ${D2} digest` });
    expect(un.className).toMatch(/danger-outline/);
    expect(un.textContent).toBe('Unpublish');
    expect(within(c).queryByRole('button', { name: /Publish for everyone/ })).toBeNull();
  });
  it('shows a failed digest with its error and an empty one with "Nothing usable came back."; neither can be published', () => {
    const failed = digest('44444444-4444-4444-8444-444444444444', { createdAt: '2026-11-26T04:00:00.000Z', status: 'failed', error: 'The research service is down.' });
    const empty = digest('55555555-5555-4555-8555-555555555555', { createdAt: '2026-11-25T04:00:00.000Z', status: 'empty' });
    show({ digests: [failed, empty, D_DRAFT], selected: D_DRAFT });
    expect(within(card('26 November 2026')).getByText('The research service is down.')).toBeTruthy();
    expect(within(card('25 November 2026')).getByText('Nothing usable came back.')).toBeTruthy();
    for (const d of ['26 November 2026', '25 November 2026']) {
      expect((within(card(d)).getByRole('button', { name: `Publish for everyone: ${d} digest` }) as HTMLButtonElement).disabled).toBe(true);
      expect((within(card(d)).getByRole('button', { name: `Preview on site: ${d} digest` }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
  it('Publish for everyone and Preview on site are disabled, with a visible hint, when no item is shown', () => {
    const none = digest(D_DRAFT.id, { items: ITEMS.map(i => ({ ...i, show: false })) });
    show({ digests: [none], selected: none });
    const c = card(D1);
    const pub = within(c).getByRole('button', { name: `Publish for everyone: ${D1} digest` }) as HTMLButtonElement;
    const prev = within(c).getByRole('button', { name: `Preview on site: ${D1} digest` }) as HTMLButtonElement;
    expect(pub.disabled).toBe(true);
    expect(prev.disabled).toBe(true);
    const hint = within(c).getByText(/Switch on at least one item to preview or publish/);
    expect(prev.getAttribute('aria-describedby')).toBe(hint.id);
    expect(pub.getAttribute('aria-describedby')).toBe(hint.id);
  });
  it('shows no hint and enables both buttons when an item is shown', () => {
    show();
    const c = card(D1);
    expect(within(c).queryByText(/Switch on at least one item/)).toBeNull();
    expect((within(c).getByRole('button', { name: `Publish for everyone: ${D1} digest` }) as HTMLButtonElement).disabled).toBe(false);
    expect((within(c).getByRole('button', { name: `Preview on site: ${D1} digest` }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('MarketTrendsAdmin: preview', () => {
  it('Preview on site POSTs the digest id, toasts the date, and offers a link to /trending and a Stop previewing button that always works', async () => {
    routes.push((u, i) => (u === '/api/admin/trends/preview' ? res(200, { ok: true }) : null));
    show({ publicOrigin: 'https://shop.example.com' });
    expect(screen.queryByRole('link', { name: 'Open /trending' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Preview on site: ${D1} digest` }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(`Previewing the ${D1} digest. Open /trending while signed in.`));
    const [c] = calls('POST', /\/preview$/);
    expect(body(c)).toEqual({ id: D_DRAFT.id });
    expect(screen.getByRole('link', { name: 'Open /trending' }).getAttribute('href')).toBe('https://shop.example.com/trending');

    fireEvent.click(screen.getByRole('button', { name: 'Stop previewing' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Preview is off.'));
    expect(calls('DELETE', /\/preview$/)).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Open /trending' })).toBeNull();
  });
  it('Stop previewing is there from the start, so a leftover cookie can be cleared after a reload', async () => {
    routes.push((u, i) => (u === '/api/admin/trends/preview' && i?.method === 'DELETE' ? res(200, { ok: true }) : null));
    show();
    const stop = screen.getByRole('button', { name: 'Stop previewing' });
    expect(stop.className).toMatch(/\bbutton\b/);
    fireEvent.click(stop);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Preview is off.'));
  });
  it('a failed preview shows the error in a toast and no link', async () => {
    routes.push(u => (u === '/api/admin/trends/preview' ? res(404, { error: 'Digest not found.' }) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: `Preview on site: ${D1} digest` }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Digest not found\./));
    expect(screen.queryByRole('link', { name: 'Open /trending' })).toBeNull();
  });
});

describe('MarketTrendsAdmin: publish and unpublish', () => {
  it('Publish for everyone POSTs, flips the card to Published, and the previously published digest becomes a draft', async () => {
    const published = { ...D_DRAFT, publishedAt: '2026-11-26T05:00:00.000Z', publishedBy: 'boss@x.co' };
    routes.push(u => (u === `/api/admin/trends/${D_DRAFT.id}/publish` ? res(200, published) : null));
    show();
    const btn = screen.getByRole('button', { name: `Publish for everyone: ${D1} digest` });
    fireEvent.click(btn);
    await waitFor(() => expect(within(card(D1)).getByText('Published')).toBeTruthy());
    expect(calls('POST', /\/publish$/)).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toMatch(new RegExp(`Published the ${D1} digest`));
    expect(within(card(D2)).getByText('Draft')).toBeTruthy();
    expect(within(card(D1)).getByRole('button', { name: `Unpublish: ${D1} digest` })).toBeTruthy();
    // the open digest is published now, so its items are locked
    expect(screen.getByText('Unpublish to edit')).toBeTruthy();
  });
  it('publishing another digest unlocks the open one: its card is a draft again and its items can be edited', async () => {
    const published = { ...D_DRAFT, publishedAt: '2026-11-26T05:00:00.000Z', publishedBy: 'boss@x.co' };
    routes.push(u => (u === `/api/admin/trends/${D_DRAFT.id}/publish` ? res(200, published) : null));
    show({ selected: D_PUB }); // the published digest is the open one
    expect(screen.getByText('Unpublish to edit')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Publish for everyone: ${D1} digest` }));
    await waitFor(() => expect(within(card(D1)).getByText('Published')).toBeTruthy());
    expect(within(card(D2)).getByText('Draft')).toBeTruthy();
    expect(within(card(D2)).getByRole('button', { name: `Publish for everyone: ${D2} digest` })).toBeTruthy();
    // the open digest is still D2 and is no longer locked
    expect((screen.getByRole('combobox', { name: 'Digest' }) as HTMLSelectElement).value).toBe(D_PUB.id);
    expect(screen.queryByText('Unpublish to edit')).toBeNull();
    const r = row('Published thing');
    expect((within(r).getByRole('checkbox') as HTMLInputElement).disabled).toBe(false);
    expect((within(r).getByRole('combobox') as HTMLSelectElement).disabled).toBe(false);
    expect((within(r).getByRole('button', { name: /^Edit/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '+ Add an item by hand' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('a failed publish shows the server message and keeps the card a draft', async () => {
    routes.push(u => (u.endsWith('/publish') ? res(409, { error: 'Another digest was published at the same moment. Try again.' }) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: `Publish for everyone: ${D1} digest` }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/published at the same moment/));
    expect(within(card(D1)).getByText('Draft')).toBeTruthy();
    expect((screen.getByRole('button', { name: `Publish for everyone: ${D1} digest` }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('Unpublish sends DELETE and turns the card back into a draft', async () => {
    const draft = { ...D_PUB, publishedAt: null, publishedBy: null };
    routes.push(u => (u === `/api/admin/trends/${D_PUB.id}/publish` ? res(200, draft) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: `Unpublish: ${D2} digest` }));
    await waitFor(() => expect(within(card(D2)).getByText('Draft')).toBeTruthy());
    expect(calls('DELETE', /\/publish$/)).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toMatch(new RegExp(`Unpublished the ${D2} digest`));
  });
});

describe('MarketTrendsAdmin: the items list', () => {
  it('has a Shown checkbox, a title with the reason, source names, our match, a Kind select and Edit on every row', () => {
    show();
    expect(screen.getAllByTestId('trend-item')).toHaveLength(3);
    const a = row('Block prints in natural dyes');
    const box = within(a).getByRole('checkbox', { name: 'Show Block prints in natural dyes on /trending' }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(within(a).getByText('Shown')).toBeTruthy();
    expect(within(a).getByText('Why a is rising now.')).toBeTruthy();
    expect(within(a).getByRole('link', { name: 'Pinterest Trends' }).getAttribute('href')).toBe('https://pinterest.example.com/t');
    expect(within(a).getByText(/Our research/)).toBeTruthy();
    expect(within(a).getByText('We have 3 pieces')).toBeTruthy();
    const kind = within(a).getByRole('combobox', { name: 'Kind of Block prints in natural dyes' }) as HTMLSelectElement;
    expect(kind.value).toBe('craft');
    expect(within(kind).getAllByRole('option').map(o => o.textContent)).toEqual(['Craft', 'Art', 'Workshop']);
    expect(kind.className).toMatch(/admin-status-select/);
    expect(within(a).getByRole('button', { name: 'Edit Block prints in natural dyes' }).textContent).toBe('Edit');
  });
  it('says Hidden for an item that is off, and each source name and each match line appears once per row', () => {
    show();
    const c = row('Miniature paintings as wall sets');
    expect(within(c).getByText('Hidden')).toBeTruthy();
    expect((within(c).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByText(/Studio Desk/)).toHaveLength(1);
    expect(within(c).getAllByText(/Not listed yet|We have/)).toHaveLength(1);
    expect(within(c).getByText('Not listed yet')).toBeTruthy();
  });
  it('words the match by kind and count: pieces, workshops, one of each, none', () => {
    show();
    expect(within(row('Block printing for beginners')).getByText('We have 1 workshop')).toBeTruthy();
    cleanup();
    show({ matched: match(ITEMS, { a: 1, b: 4 }) });
    expect(within(row('Block prints in natural dyes')).getByText('We have 1 piece')).toBeTruthy();
    expect(within(row('Block printing for beginners')).getByText('We have 4 workshops')).toBeTruthy();
  });
  it('toggling Shown PATCHes the item and flips the label and the card counts without a reload', async () => {
    const after = { ...D_DRAFT, items: ITEMS.map(i => (i.id === 'a' ? { ...i, show: false } : i)) };
    routes.push((u, i) => (u === `/api/admin/trends/${D_DRAFT.id}/items/a` && i?.method === 'PATCH' ? res(200, after) : null));
    show();
    fireEvent.click(within(row('Block prints in natural dyes')).getByRole('checkbox'));
    await waitFor(() => expect(within(row('Block prints in natural dyes')).getByText('Hidden')).toBeTruthy());
    expect(body(calls('PATCH', /items\/a$/)[0])).toEqual({ show: false });
    expect(within(card(D1)).getByText(/^3 items, 1 shown\./)).toBeTruthy();
  });
  it('changing Kind PATCHes it', async () => {
    const after = { ...D_DRAFT, items: ITEMS.map(i => (i.id === 'a' ? { ...i, kind: 'art' as const } : i)) };
    routes.push((u, i) => (u === `/api/admin/trends/${D_DRAFT.id}/items/a` && i?.method === 'PATCH' ? res(200, after) : null));
    routes.push(u => (u === `/api/admin/trends/${D_DRAFT.id}` ? res(200, { digest: after, matched: match(after.items, { a: 2 }) }) : null));
    show();
    fireEvent.change(within(row('Block prints in natural dyes')).getByRole('combobox'), { target: { value: 'art' } });
    await waitFor(() => expect((within(row('Block prints in natural dyes')).getByRole('combobox') as HTMLSelectElement).value).toBe('art'));
    expect(body(calls('PATCH', /items\/a$/)[0])).toEqual({ kind: 'art' });
    await waitFor(() => expect(within(row('Block prints in natural dyes')).getByText('We have 2 pieces')).toBeTruthy()); // the match is read again after a kind change
  });
  it('a failed toggle shows the server message in a toast and leaves the row as it was', async () => {
    routes.push(u => (u.includes('/items/') ? res(409, { error: 'Unpublish it first.' }) : null));
    show();
    fireEvent.click(within(row('Block prints in natural dyes')).getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Unpublish it first\./));
    expect((within(row('Block prints in natural dyes')).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
  it('on a published digest the Shown checkbox, Kind select and Edit are disabled, "Unpublish to edit" is shown once, and adding is disabled', () => {
    show({ selected: D_PUB });
    expect(screen.getAllByText('Unpublish to edit')).toHaveLength(1);
    const r = row('Published thing');
    expect((within(r).getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect((within(r).getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
    expect((within(r).getByRole('button', { name: /^Edit/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '+ Add an item by hand' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('on a draft there is no "Unpublish to edit" note', () => {
    show();
    expect(screen.queryByText('Unpublish to edit')).toBeNull();
  });
  it('a failed or empty digest has no items list to check', () => {
    const failed = digest('44444444-4444-4444-8444-444444444444', { status: 'failed', error: 'Down.' });
    show({ digests: [failed], selected: failed });
    expect(screen.queryByText('Check the items')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add an item by hand' })).toBeNull();
  });
});

describe('MarketTrendsAdmin: add by hand and edit', () => {
  const fillAdd = (over: { title?: string } = {}) => {
    const d = screen.getByRole('dialog');
    fireEvent.change(within(d).getByLabelText('Title'), { target: { value: over.title ?? 'Bamboo lamp shades' } });
    fireEvent.change(within(d).getByLabelText('Why it is rising'), { target: { value: 'Searches doubled this month.' } });
    fireEvent.change(within(d).getByLabelText('Category'), { target: { value: 'Home decor' } });
    fireEvent.change(within(d).getByLabelText(/^Tags/), { target: { value: 'bamboo, lamp , ,light' } });
    fireEvent.change(within(d).getByLabelText('Kind'), { target: { value: 'craft' } });
    fireEvent.change(within(d).getByLabelText('Where it came from'), { target: { value: 'pinterest' } });
    fireEvent.change(within(d).getByLabelText('Source 1 name'), { target: { value: 'Pinterest Trends' } });
    fireEvent.change(within(d).getByLabelText('Source 1 link (https, optional)'), { target: { value: 'https://pinterest.example.com/x' } });
    return d;
  };
  it('opens a dialog with title, why, category, tags, kind, origin and a source; required fields carry required and optional ones do not', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    const d = screen.getByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'Add an item by hand' })).toBeTruthy();
    const f = (l: string) => within(d).getByLabelText(l === 'Tags' ? /^Tags/ : l) as HTMLInputElement;
    for (const l of ['Title', 'Why it is rising', 'Kind', 'Where it came from', 'Source 1 name']) expect(f(l).required, l).toBe(true);
    for (const l of ['Category', 'Tags', 'Source 1 link (https, optional)']) expect(f(l).required, l).toBe(false);
    expect(f('Title').maxLength).toBe(120);
    expect(f('Title').minLength).toBe(3);
    expect(f('Why it is rising').maxLength).toBe(400);
    expect(f('Category').maxLength).toBe(60);
    expect(f('Source 1 name').maxLength).toBe(80);
    const link = f('Source 1 link (https, optional)');
    expect(link.type).toBe('url');
    expect(link.maxLength).toBe(300);
    expect(link.pattern).toBe('https://.+');
    expect(within(f('Where it came from')).getAllByRole('option').map(o => o.textContent)).toEqual(['Pinterest', 'Manual research']);
    expect(within(f('Kind')).getAllByRole('option').map(o => o.textContent)).toEqual(['Craft', 'Art', 'Workshop']);
    expect(d.querySelector('.lbl')!.textContent).not.toMatch(/\*/);
  });
  it('POSTs the item with its origin, closes, and shows the new row hidden', async () => {
    const added = { ...D_DRAFT, items: [...ITEMS, item('new', { title: 'Bamboo lamp shades', show: false, origin: 'pinterest', sources: [{ title: 'Pinterest Trends', url: 'https://pinterest.example.com/x' }] })] };
    routes.push((u, i) => (u === `/api/admin/trends/${D_DRAFT.id}/items` && i?.method === 'POST' ? res(201, added) : null));
    routes.push(u => (u === `/api/admin/trends/${D_DRAFT.id}` ? res(200, { digest: added, matched: match(added.items) }) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    fillAdd();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(body(calls('POST', /\/items$/)[0])).toEqual({
      title: 'Bamboo lamp shades', why: 'Searches doubled this month.', category: 'Home decor', tags: ['bamboo', 'lamp', 'light'], kind: 'craft', origin: 'pinterest',
      sources: [{ title: 'Pinterest Trends', url: 'https://pinterest.example.com/x' }],
    });
    expect(within(row('Bamboo lamp shades')).getByText('Hidden')).toBeTruthy();
    expect(within(card(D1)).getByText(/^4 items, 2 shown\./)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Item added/);
  });
  it('leaves out a blank category and a blank link', async () => {
    routes.push((u, i) => (u.endsWith('/items') && i?.method === 'POST' ? res(201, D_DRAFT) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    const d = fillAdd();
    fireEvent.change(within(d).getByLabelText('Category'), { target: { value: '' } });
    fireEvent.change(within(d).getByLabelText(/^Tags/), { target: { value: '' } });
    fireEvent.change(within(d).getByLabelText('Source 1 link (https, optional)'), { target: { value: '' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(calls('POST', /\/items$/)).toHaveLength(1));
    const sent = body(calls('POST', /\/items$/)[0]);
    expect(sent.category).toBeUndefined();
    expect(sent.tags).toEqual([]);
    expect(sent.sources).toEqual([{ title: 'Pinterest Trends' }]);
  });
  it('keeps the dialog open with the server message shown inside it (not as a toast), and the Add button busy meanwhile', async () => {
    let release!: (r: Response) => void;
    routes.push((u, i) => (u.endsWith('/items') && i?.method === 'POST' ? new Promise<Response>(r => { release = r; }) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    const d = fillAdd();
    const submit = within(d).getByRole('button', { name: 'Add item' }) as HTMLButtonElement;
    fireEvent.click(submit);
    await waitFor(() => expect(submit.getAttribute('aria-busy')).toBe('true'));
    expect(submit.disabled).toBe(true);
    await act(async () => { release({ ok: false, status: 400, json: () => Promise.resolve({ error: 'title must be 3 to 120 characters.' }) } as Response); });
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe('title must be 3 to 120 characters.'));
    expect(submit.disabled).toBe(false);
    expect((within(d).getByLabelText('Title') as HTMLInputElement).value).toBe('Bamboo lamp shades'); // the typing is kept
    expect(screen.getAllByRole('alert')).toHaveLength(1); // the error is not duplicated as a toast
  });
  it('takes up to 4 sources and at least 1', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    const d = screen.getByRole('dialog');
    expect((within(d).getByRole('button', { name: 'Remove source 1' }) as HTMLButtonElement).disabled).toBe(true);
    const add = () => within(d).getByRole('button', { name: 'Add a source' }) as HTMLButtonElement;
    fireEvent.click(add()); fireEvent.click(add()); fireEvent.click(add());
    expect(within(d).getByLabelText('Source 4 name')).toBeTruthy();
    expect(add().disabled).toBe(true);
    fireEvent.click(within(d).getByRole('button', { name: 'Remove source 2' }));
    expect(within(d).queryByLabelText('Source 4 name')).toBeNull();
    expect(add().disabled).toBe(false);
  });
  it('Edit opens the same fields filled from the item (no origin), and Save PATCHes the changed fields', async () => {
    const after = { ...D_DRAFT, items: ITEMS.map(i => (i.id === 'a' ? { ...i, title: 'Block prints, new name' } : i)) };
    routes.push((u, i) => (u === `/api/admin/trends/${D_DRAFT.id}/items/a` && i?.method === 'PATCH' ? res(200, after) : null));
    routes.push(u => (u === `/api/admin/trends/${D_DRAFT.id}` ? res(200, { digest: after, matched: match(after.items) }) : null));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Block prints in natural dyes' }));
    const d = screen.getByRole('dialog');
    expect(within(d).getByRole('heading', { name: 'Edit item' })).toBeTruthy();
    expect(within(d).queryByLabelText('Where it came from')).toBeNull();
    expect((within(d).getByLabelText('Title') as HTMLInputElement).value).toBe('Block prints in natural dyes');
    expect((within(d).getByLabelText('Category') as HTMLInputElement).value).toBe('Textiles');
    expect((within(d).getByLabelText(/^Tags/) as HTMLInputElement).value).toBe('block, dye');
    expect((within(d).getByLabelText('Source 1 name') as HTMLInputElement).value).toBe('Pinterest Trends');
    expect((within(d).getByLabelText('Source 2 name') as HTMLInputElement).value).toBe('Our research');
    expect((within(d).getByLabelText('Source 2 link (https, optional)') as HTMLInputElement).value).toBe('');
    fireEvent.change(within(d).getByLabelText('Title'), { target: { value: 'Block prints, new name' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(body(calls('PATCH', /items\/a$/)[0])).toEqual({
      title: 'Block prints, new name', why: 'Why a is rising now.', category: 'Textiles', tags: ['block', 'dye'], kind: 'craft',
      sources: [{ title: 'Pinterest Trends', url: 'https://pinterest.example.com/t' }, { title: 'Our research' }],
    });
    expect(screen.getByRole('heading', { name: 'Block prints, new name' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Item saved/);
  });
  it('Escape, Cancel and the close button close the dialog without saving, and focus goes back to the Edit button', () => {
    show();
    const edit = screen.getByRole('button', { name: 'Edit Block prints in natural dyes' });
    for (const close of [
      () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }),
      () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })),
      () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' })),
    ]) {
      edit.focus();
      fireEvent.click(edit);
      expect(screen.getByRole('dialog')).toBeTruthy();
      close();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(edit);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('a click on the dialog itself (its padding, or the end of a drag that started in a field) does not close it, so typing is never lost', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    const d = screen.getByRole('dialog');
    fireEvent.change(within(d).getByLabelText('Title'), { target: { value: 'Half typed' } });
    fireEvent.click(d); // a click in the padding
    expect(screen.getByRole('dialog')).toBeTruthy();
    const input = within(d).getByLabelText('Title');
    fireEvent.mouseDown(input); // a drag-select that starts in a field and is released over the padding
    fireEvent.mouseUp(d);
    fireEvent.click(d);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((within(screen.getByRole('dialog')).getByLabelText('Title') as HTMLInputElement).value).toBe('Half typed');
  });
  it('puts focus in the first field when the dialog opens, and names the dialog by its heading', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    expect(screen.getByRole('dialog', { name: 'Add an item by hand' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
  });
});

describe('MarketTrendsAdmin: accessibility', () => {
  it('every button, select, checkbox and text field has an accessible name', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: '+ Add an item by hand' }));
    const all = [...document.querySelectorAll('button, select, input, textarea')] as HTMLElement[];
    expect(all.length).toBeGreaterThan(15);
    for (const el of all) {
      const name = el.getAttribute('aria-label') || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent;
      expect(name?.trim(), el.outerHTML.slice(0, 120)).toBeTruthy();
    }
  });
});

describe('source contract: tab, page and stylesheet', () => {
  it('the new tab sits right after Trending', () => {
    const tabs = fs.readFileSync('src/components/AdminTabs.tsx', 'utf8');
    expect(tabs).toMatch(/href: '\/dashboard\/trending', label: 'Trending' \},\s*\{ href: '\/dashboard\/market-trends', label: 'Market trends' \}/);
  });
  it('the page is admin only and has breadcrumbs Home, Dashboard, Market trends', () => {
    const page = fs.readFileSync('src/app/dashboard/market-trends/page.tsx', 'utf8');
    expect(page).toContain('await requireAdminPage()');
    expect(page).toContain('<Breadcrumbs');
    expect(page).toMatch(/name: 'Home'[\s\S]*name: 'Dashboard'[\s\S]*name: 'Market trends', path: '\/dashboard\/market-trends'/);
  });
  const norm = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const css = norm(fs.readFileSync('src/components/MarketTrendsAdmin.css', 'utf8'));
  it('the stylesheet uses tokens only: no hex, no font family or font name, only sizes from the admin type scale', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/font-family|DM Sans|Georgia|Arial|Helvetica|Inter\b|Roboto|system-ui|monospace/i);
    const sizes = [...css.matchAll(/font(?:-size)?: (?:\d+ )?(?:clamp\()?(\d+)px(?:, [\d.]+vw, (\d+)px)?/g)].flatMap(m => [m[1], m[2]]).filter(Boolean).map(Number);
    for (const s of sizes) expect([9, 10, 11, 12, 22, 26]).toContain(s);
    for (const m of css.matchAll(/font: [^;}]*var\(--font-[^)]*\)/g)) expect(m[0]).toMatch(/var\(--font-(sans|display)\)/);
  });
  it('selects keep the global chevron: no appearance, no background shorthand, no background-image on a select', () => {
    expect(css).not.toMatch(/appearance/);
    for (const m of css.matchAll(/([^{}]*select[^{}]*) \{([^}]*)\}/g)) {
      expect(m[2], m[1]).not.toMatch(/(?:^|[ ;])background:/);
      expect(m[2], m[1]).not.toMatch(/background-image/);
    }
  });
  it('controls in a row share the control height token', () => {
    expect(css).toContain('var(--control-h)');
  });
  it('no inline style attributes or font families in the component', () => {
    const src = fs.readFileSync('src/components/MarketTrendsAdmin.tsx', 'utf8');
    expect(src).not.toMatch(/style=\{|style="/);
    expect(src).not.toMatch(/fontFamily|font-family/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe('the page', () => {
  const asDate = <T extends { createdAt: string; publishedAt: string | null }>(d: T) => ({ ...d, createdAt: new Date(d.createdAt), publishedAt: d.publishedAt ? new Date(d.publishedAt) : null });
  const all = [D_DRAFT, D_PUB];
  beforeEach(() => {
    gate.requireAdminPage.mockClear(); gate.requireAdminPage.mockImplementation(async () => undefined);
    store.listDigests.mockReset().mockResolvedValue(all.map(d => asDate(summary(d))));
    store.getDigest.mockReset().mockImplementation(async (id: string) => { const d = all.find(x => x.id === id); return d ? asDate(d) : null; });
    store.matchItems.mockReset().mockImplementation(async (items: TrendItem[]) => match(items));
    store.getTrendSettings.mockReset().mockResolvedValue({ keySet: true, model: 'm', region: '', source: 'saved', hasStoredRow: true });
  });
  const open = async (sp: Record<string, string | string[] | undefined> = {}) => render(await MarketTrendsPage({ searchParams: Promise.resolve(sp) }));
  const picked = () => (screen.getByRole('combobox', { name: 'Digest' }) as HTMLSelectElement).value;

  it('is admin only: the gate runs first and nothing is read when it refuses', async () => {
    gate.requireAdminPage.mockRejectedValue(new Error('NEXT_NOT_FOUND'));
    await expect(MarketTrendsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(store.listDigests).not.toHaveBeenCalled();
    expect(store.getTrendSettings).not.toHaveBeenCalled();
  });
  it('opens the newest digest by default, with breadcrumbs Home, Dashboard, Market trends', async () => {
    await open();
    expect(picked()).toBe(D_DRAFT.id);
    expect(screen.getByRole('heading', { name: 'Block prints in natural dyes' })).toBeTruthy();
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getAllByRole('link').map(a => a.textContent)).toEqual(['Home', 'Dashboard']);
    expect(crumbs.getByText('Market trends').getAttribute('aria-current')).toBe('page');
  });
  it('opens the digest named in ?d=', async () => {
    await open({ d: D_PUB.id });
    expect(picked()).toBe(D_PUB.id);
    expect(screen.getByRole('heading', { name: 'Published thing' })).toBeTruthy();
  });
  it('falls back to the newest for an unknown or repeated ?d=', async () => {
    await open({ d: 'nope' });
    expect(picked()).toBe(D_DRAFT.id);
    cleanup();
    await open({ d: [D_PUB.id, D_DRAFT.id] });
    expect(picked()).toBe(D_DRAFT.id);
    expect(store.getDigest).not.toHaveBeenCalledWith('nope');
  });
  it('shows the empty state with no digests, and tells the component whether a key is saved', async () => {
    store.listDigests.mockResolvedValue([]);
    store.getTrendSettings.mockResolvedValue({ keySet: false, model: 'm', region: '', source: 'none', hasStoredRow: false });
    await open();
    expect(screen.getByText(/No digests yet/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Fetch trends' }) as HTMLButtonElement).disabled).toBe(true);
    expect(store.matchItems).not.toHaveBeenCalled();
  });
});
