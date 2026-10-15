// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));

import { PostsAdmin } from '@/components/PostsAdmin';
import { artistKey } from '@/lib/artist';
import type { Product } from '@/lib/types';

const mk = (id: string, name: string, seller: string, status = 'APPROVED', extra: Partial<Product> = {}): Product => ({
  id, name, category: 'Accessories', city: 'Jaipur', pricePaise: 85000, seller, description: 'd', stock: 3, status, ...extra,
});
let db: Product[];
let fetchMock: ReturnType<typeof vi.fn>;
let postDelay: Promise<void> | null;

const artistsOf = (list: Product[]) => {
  const m = new Map<string, any>();
  for (const p of list) {
    const key = artistKey(p.seller);
    const a = m.get(key) ?? { key, name: p.seller.trim(), total: 0, published: 0, drafts: 0 };
    a.total++; p.status === 'APPROVED' ? a.published++ : a.drafts++; m.set(key, a);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
};
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  db = [mk('p3', 'Draft Dish', 'Neel Mitti', 'DRAFT'), mk('p2', 'Boat Charm', 'Lake City Knots'), mk('p1', 'Lily Bouquet', 'Shauk and Stuff', 'APPROVED', { imageUrl: 'https://cdn.example.com/l.jpg' })];
  postDelay = null;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/admin/products') return res(200, db);
    if (url === '/api/admin/artists') return res(200, artistsOf(db));
    if (method === 'POST' && url === '/api/products') {
      if (postDelay) await postDelay;
      const body = JSON.parse(String(init!.body));
      if (body.pricePaise == null) return res(400, { error: 'pricePaise must be an integer between 0 and 10000000.' });
      if (body.imageUrl && !String(body.imageUrl).startsWith('https://')) return res(400, { error: 'imageUrl must be an https URL up to 500 characters.' });
      const p = mk('p9', body.name, body.seller, body.status, { pricePaise: body.pricePaise });
      db = [p, ...db]; return res(201, p);
    }
    const m = /^\/api\/products\/(.+)$/.exec(url);
    if (m && method === 'PATCH') {
      const i = db.findIndex(p => p.id === m[1]);
      if (i < 0) return res(404, { error: 'Product not found.' });
      db[i] = { ...db[i], ...JSON.parse(String(init!.body)) }; return res(200, db[i]);
    }
    if (m && method === 'DELETE') {
      if (!db.some(p => p.id === m[1])) return res(404, { error: 'Product not found.' });
      db = db.filter(p => p.id !== m[1]); return res(200, { ok: true });
    }
    return res(500, { error: 'unexpected ' + method + ' ' + url });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = () => render(<PostsAdmin initialProducts={[...db]} initialArtists={artistsOf(db)} />);
const rows = () => screen.queryAllByTestId('post-row');
const rowFor = (name: string) => rows().find(r => within(r).queryByText(name))!;
const badgeOf = (row: HTMLElement) => row.querySelector('.badge')!.textContent;
const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('PostsAdmin read', () => {
  it('lists every post including drafts, with status badges and an artist sidebar with counts', () => {
    mount();
    expect(rows()).toHaveLength(3);
    expect(badgeOf(rowFor('Draft Dish'))).toBe('Draft');
    expect(badgeOf(rowFor('Boat Charm'))).toBe('Published');
    const side = screen.getByRole('navigation', { name: 'Artists' });
    expect(within(side).getByRole('button', { name: /All artists/ }).textContent).toMatch(/3/);
    expect(within(side).getByRole('button', { name: /Neel Mitti/ }).textContent).toMatch(/1 draft/);
  });
  it('filters by artist, status and search without refetching', () => {
    mount();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Artists' })).getByRole('button', { name: /Lake City Knots/ }));
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /All artists/ }));
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'DRAFT' } });
    expect(rows().map(r => within(r).queryByText('Draft Dish') ? 'd' : 'x')).toEqual(['d']);
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Search posts'), { target: { value: 'lily' } });
    expect(rows()).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('published posts link to their public page; drafts have no public link', () => {
    mount();
    expect(within(rowFor('Lily Bouquet')).getByRole('link', { name: /View public page/ }).getAttribute('href')).toBe('/products/lily-bouquet-p1');
    expect(within(rowFor('Draft Dish')).queryByRole('link', { name: /View public page/ })).toBeNull();
  });
  it('shows an image thumbnail when imageUrl is set', () => {
    mount();
    expect(within(rowFor('Lily Bouquet')).getByRole('img').getAttribute('src')).toBe('https://cdn.example.com/l.jpg');
  });
  it('empty state', () => {
    render(<PostsAdmin initialProducts={[]} initialArtists={[]} />);
    expect(screen.getByText(/No posts yet/)).toBeTruthy();
  });
});

describe('PostsAdmin create', () => {
  const open = () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'New post' })); };
  it('creates a draft: sends rupees as paise, closes, refetches and shows the new row', async () => {
    open();
    fill(/^Title/, 'Lac Bangle'); fill(/^Artist \(seller/, 'Marwar Lac'); fill(/^Description/, 'Hand-set.');
    fill(/^Price/, '19.99'); fill(/^Stock/, '3'); fill(/^Status/, 'DRAFT');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products')!;
    expect(JSON.parse(call[1].body)).toMatchObject({ name: 'Lac Bangle', seller: 'Marwar Lac', pricePaise: 1999, stock: 3, status: 'DRAFT' });
    expect(call[1].headers['content-type']).toBe('application/json');
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.getByRole('status').textContent).toMatch(/created/i);
    expect(within(screen.getByRole('navigation', { name: 'Artists' })).getByRole('button', { name: /Marwar Lac/ })).toBeTruthy();
  });
  it('keeps the dialog and the user’s typing when the server rejects the input', async () => {
    open();
    fill(/^Title/, 'Lac Bangle'); fill(/^Artist \(seller/, 'Marwar Lac'); fill(/^Description/, 'x'); fill(/^Price/, '10'); fill(/^Stock/, '3');
    fill(/^Cover image/, 'http://cdn.example.com/a.jpg'); // valid for the browser's type=url, rejected by the server (https only)
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/imageUrl/));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Lac Bangle');
    expect((screen.getByRole('button', { name: 'Save post' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('double-clicking Save sends exactly one request', async () => {
    let release!: () => void; postDelay = new Promise(r => { release = r; });
    open();
    fill(/^Title/, 'Lac Bangle'); fill(/^Artist \(seller/, 'Marwar Lac'); fill(/^Description/, 'x'); fill(/^Price/, '10'); fill(/^Stock/, '1');
    const save = screen.getByRole('button', { name: 'Save post' });
    fireEvent.click(save); fireEvent.click(save);
    expect((screen.getByRole('button', { name: /Saving/ }) as HTMLButtonElement).disabled).toBe(true);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fetchMock.mock.calls.filter(c => c[0] === '/api/products' && c[1]?.method === 'POST')).toHaveLength(1);
  });
  it('Escape and Cancel close the form without saving', () => {
    open();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PostsAdmin edit', () => {
  it('prefills the form, PATCHes the post and shows the new values', async () => {
    mount();
    fireEvent.click(within(rowFor('Draft Dish')).getByRole('button', { name: /Edit/ }));
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Draft Dish');
    expect((screen.getByLabelText(/^Price/) as HTMLInputElement).value).toBe('850');
    fill(/^Title/, 'Published Dish'); fill(/^Status/, 'APPROVED');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products/p3')!;
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body)).toMatchObject({ name: 'Published Dish', status: 'APPROVED' });
    await waitFor(() => expect(badgeOf(rowFor('Published Dish'))).toBe('Published'));
  });
  it('editing a post that was deleted elsewhere shows the 404 message without re-fetching lists', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
    db = db.filter(p => p.id !== 'p2');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not found/i));
    expect(fetchMock.mock.calls.filter(c => String(c[0]).startsWith('/api/admin/'))).toHaveLength(0);
  });
  it('changing the artist name moves the post to another artist group', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
    fill(/^Artist \(seller/, 'Shauk and Stuff');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const side = screen.getByRole('navigation', { name: 'Artists' });
    await waitFor(() => expect(within(side).queryByRole('button', { name: /Lake City Knots/ })).toBeNull());
  });
});

describe('PostsAdmin delete', () => {
  it('requires an explicit confirm; Cancel keeps the post', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rows()).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('confirming deletes, refetches, and the artist disappears with their last post', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(fetchMock.mock.calls.some(c => c[0] === '/api/products/p2' && c[1].method === 'DELETE')).toBe(true);
    expect(within(screen.getByRole('navigation', { name: 'Artists' })).queryByRole('button', { name: /Lake City Knots/ })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/deleted/i);
  });
  it('deleting an already-deleted post shows the error without re-fetching lists', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    db = db.filter(p => p.id !== 'p2');
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not found/i));
    expect(fetchMock.mock.calls.filter(c => String(c[0]).startsWith('/api/admin/'))).toHaveLength(0);
  });
});

describe('PostsAdmin session problems', () => {
  it('explains 401/403 from the API instead of failing silently', async () => {
    mount();
    fetchMock.mockImplementation(() => res(401, { error: 'Authentication required.' }));
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/sign in again/i));
  });
});

describe('PostForm dialog focus handling', () => {
  it('moves focus into the dialog on open (first field)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    expect(document.activeElement).toBe(screen.getByLabelText(/^Title/));
  });
  it('Tab from the last control wraps to the first, Shift+Tab from the first wraps to the last', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const save = within(dialog).getByRole('button', { name: 'Save post' });
    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);
  });
  it('Tab while focus has escaped the dialog pulls it back in', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
  it('Escape closes the dialog even when focus is outside it', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('returns focus to the button that opened it', () => {
    mount();
    const opener = screen.getByRole('button', { name: 'New post' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(opener);
  });
  it('returns focus to the row Edit button after closing an edit', () => {
    mount();
    const edit = within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ });
    edit.focus();
    fireEvent.click(edit);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(document.activeElement).toBe(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
  });
});

describe('PostForm field rules', () => {
  const open = () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'New post' })); };
  it('phone input rejects malformed numbers and accepts Indian mobiles in the browser', () => {
    open();
    const phone = screen.getByLabelText(/^Phone/) as HTMLInputElement;
    for (const bad of ['12345', '5989898999', 'abcdefghij']) { fireEvent.change(phone, { target: { value: bad } }); expect(phone.validity.patternMismatch).toBe(true); }
    for (const good of ['9989898999', '+91 99898 98999', '']) { fireEvent.change(phone, { target: { value: good } }); expect(phone.validity.patternMismatch).toBe(false); }
  });
  it('mandatory fields are required and wrapped for the red asterisk', () => {
    open();
    for (const name of ['name', 'seller', 'description', 'price', 'stock']) {
      const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement;
      expect(el.required).toBe(true);
      expect(el.parentElement!.querySelector(':scope > .lbl')).toBeTruthy();
    }
    expect((document.querySelector('[name="phone"]') as HTMLInputElement).required).toBe(false);
  });
});

describe('PostsAdmin archive and quick status change', () => {
  it('the row dropdown PATCHes only the status, then the badge updates', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Change status for Boat Charm'), { target: { value: 'ARCHIVED' } });
    await waitFor(() => expect(badgeOf(rowFor('Boat Charm'))).toBe('Archived'));
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products/p2' && c[1]?.method === 'PATCH')!;
    expect(JSON.parse(call[1].body)).toEqual({ status: 'ARCHIVED' });
    expect(within(rowFor('Boat Charm')).queryByRole('link', { name: /View public page/ })).toBeNull();
  });
  it('the status filter offers Archived', () => {
    db = [...db, mk('p4', 'Old Dish', 'Neel Mitti', 'ARCHIVED')];
    mount();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'ARCHIVED' } });
    expect(rows().map(r => badgeOf(r))).toEqual(['Archived']);
  });
  it('selecting the current status does nothing', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Change status for Boat Charm'), { target: { value: 'APPROVED' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('failed writes do not re-fetch', () => {
  it('a rejected status change shows the API error, keeps the row, and makes no GET calls', async () => {
    mount();
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'PATCH' ? res(400, { error: 'status must be one of: APPROVED, DRAFT.' }) : res(200, []));
    fireEvent.change(screen.getByLabelText('Change status for Boat Charm'), { target: { value: 'ARCHIVED' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/must be one of/));
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual(['/api/products/p2']);
    expect(badgeOf(rowFor('Boat Charm'))).toBe('Published');
  });
});

describe('toasts', () => {
  afterEach(() => { vi.useRealTimers(); });
  const change = async (name: string, value: string) => {
    fireEvent.change(screen.getByLabelText(`Change status for ${name}`), { target: { value } });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  };
  const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  it('success is green and auto-closes after 3 seconds', async () => {
    vi.useFakeTimers();
    mount();
    await change('Boat Charm', 'DRAFT');
    const toast = screen.getByRole('status');
    expect(toast.className).toContain('success');
    expect(toast.textContent).toMatch(/status updated/);
    await wait(2800);
    expect(screen.queryByRole('status')).toBeTruthy();
    await wait(300);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('error is red and auto-closes after 3 seconds', async () => {
    vi.useFakeTimers();
    mount();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => init?.method === 'PATCH' ? res(400, { error: 'nope' }) : res(200, []));
    await change('Boat Charm', 'DRAFT');
    const toast = screen.getByRole('alert');
    expect(toast.className).toContain('error');
    expect(toast.textContent).toMatch(/nope/);
    await wait(3100);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('the close button dismisses immediately', async () => {
    vi.useFakeTimers();
    mount();
    await change('Boat Charm', 'DRAFT');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('a newer toast restarts the 3 second timer', async () => {
    vi.useFakeTimers();
    mount();
    await change('Boat Charm', 'DRAFT');
    await wait(2000);
    await change('Lily Bouquet', 'DRAFT');
    expect(screen.getByRole('status').textContent).toMatch(/Lily Bouquet/);
    await wait(2000);
    expect(screen.queryByRole('status')).toBeTruthy();
    await wait(1100);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
