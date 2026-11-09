// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));

import { PostsAdmin } from '@/components/PostsAdmin';
import { wantsNewPost } from '@/lib/new-post-param';
import { artistKey } from '@/lib/artist';
import type { AdminProduct as Product } from '@/lib/types';

const mk = (id: string, name: string, seller: string, status = 'APPROVED', extra: Partial<Product> = {}): Product => ({
  id, name, category: 'Accessories', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 85000, seller, description: 'd', stock: 3, status,
  sellerId: `u-${seller}`, sellerEmail: `${seller.split(' ')[0].toLowerCase()}@x.co`, ...extra,
});
const PLACES = [{ label: 'Kota, Rajasthan', name: 'Kota', state: 'Rajasthan', ref: 'REF-KOTA' }];
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
    if (url.startsWith('/api/places?')) return res(200, PLACES);
    if (url === '/api/admin/products') return res(200, db);
    if (url === '/api/admin/artists') return res(200, artistsOf(db));
    if (method === 'POST' && url === '/api/products') {
      if (postDelay) await postDelay;
      const body = JSON.parse(String(init!.body));
      if (body.pricePaise == null) return res(400, { error: 'pricePaise must be an integer between 0 and 10000000.' });
      if (body.description === 'REJECT') return res(400, { error: 'description is not allowed.' });
      const p = mk('p9', body.name, 'Me Studio', body.status, { pricePaise: body.pricePaise });
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

const CATEGORIES = ['Crochet & Textiles', 'Accessories', 'Resin Art', 'Pottery'];
const WORKSHOPS = [{ id: 'w1', title: 'Beginner Crochet' }, { id: 'w2', title: 'Tote Bag Painting' }];
const SELLERS = [{ id: 'u-Shauk', name: 'Shauk and Stuff', email: 'shauk@x.co', phone: '9989898999' }, { id: 'u-Lake', name: 'Lake City Knots', email: 'lake@x.co' }, { id: 'u-Lake2', name: 'Lake City Knots', email: 'lake2@x.co', phone: '9876543210' }];
const PROFILE = { userId: 'me', displayName: 'My Studio' };
const ME = { id: 'me', name: 'Shelly Agarwal', email: 'root@x.co', phone: '9989898999' };
const mount = (role: 'admin' | 'seller' = 'admin') => render(<PostsAdmin initialProducts={[...db]} initialArtists={artistsOf(db)} role={role} categories={CATEGORIES} workshops={WORKSHOPS} sellers={role === 'admin' ? SELLERS : []} me={ME} profile={PROFILE} />);
const mountNew = (role: 'admin' | 'seller' = 'admin') => render(<PostsAdmin initialProducts={[...db]} initialArtists={artistsOf(db)} role={role} categories={CATEGORIES} workshops={WORKSHOPS} sellers={role === 'admin' ? SELLERS : []} me={ME} profile={PROFILE} openNew />);
const rows = () => screen.queryAllByTestId('post-row');
const rowFor = (name: string) => rows().find(r => within(r).queryByText(name))!;
const badgeOf = (row: HTMLElement) => row.querySelector('.badge')!.textContent;
const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** Cities can only be chosen from the place search: type, then click the suggestion. */
const pickCity = async () => {
  fill(/^City/, 'kota');
  fireEvent.mouseDown(await screen.findByRole('option', { name: 'Kota, Rajasthan' }));
};

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
    render(<PostsAdmin initialProducts={[]} initialArtists={[]} role="admin" />);
    expect(screen.getByText(/No posts yet/)).toBeTruthy();
  });
});

describe('PostsAdmin create', () => {
  const open = () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'New post' })); };
  it('the new-post form defaults the status to Draft for admins and sellers', () => {
    open();
    expect((screen.getByLabelText(/^Status/) as HTMLSelectElement).value).toBe('DRAFT');
    cleanup();
    mount('seller'); fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    expect((screen.getByLabelText(/^Status/) as HTMLSelectElement).value).toBe('DRAFT');
  });
  it('creates a draft: sends rupees as paise, closes, refetches and shows the new row', async () => {
    open();
    await pickCity();
    fill(/^Title/, 'Lac Bangle'); fill(/^Description/, 'Hand-set.');
    fill(/^Price/, '19.99'); fill(/^Stock/, '3'); fill(/^Status/, 'DRAFT');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products')!;
    expect(JSON.parse(call[1].body)).toMatchObject({ name: 'Lac Bangle', pricePaise: 1999, stock: 3, status: 'DRAFT', workshopId: '', pickupLocation: '', sellerId: '', cityRef: 'REF-KOTA' });
    expect(JSON.parse(call[1].body)).not.toHaveProperty('seller');
    expect(JSON.parse(call[1].body)).not.toHaveProperty('city');
    expect(JSON.parse(call[1].body)).not.toHaveProperty('cityId');
    expect(call[1].headers['content-type']).toBe('application/json');
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.getByRole('status').textContent).toMatch(/created/i);
    expect(within(screen.getByRole('navigation', { name: 'Artists' })).getByRole('button', { name: /Me Studio/ })).toBeTruthy();
  });
  it('keeps the dialog and the user’s typing when the server rejects the input', async () => {
    open();
    await pickCity();
    fill(/^Title/, 'Lac Bangle'); fill(/^Description/, 'REJECT'); fill(/^Price/, '10'); fill(/^Stock/, '3'); // the mocked server refuses this description
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/description is not allowed/));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Lac Bangle');
    expect((screen.getByRole('button', { name: 'Save post' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('double-clicking Save sends exactly one request', async () => {
    let release!: () => void; postDelay = new Promise(r => { release = r; });
    open();
    await pickCity();
    fill(/^Title/, 'Lac Bangle'); fill(/^Description/, 'x'); fill(/^Price/, '10'); fill(/^Stock/, '1');
    const save = screen.getByRole('button', { name: 'Save post' });
    fireEvent.click(save); fireEvent.click(save);
    expect((screen.getByRole('button', { name: /Saving/ }) as HTMLButtonElement).disabled).toBe(true);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fetchMock.mock.calls.filter(c => c[0] === '/api/products' && c[1]?.method === 'POST')).toHaveLength(1);
  });
  it('a typed city that was not chosen from the suggestions blocks the save (no request)', async () => {
    open();
    fill(/^Title/, 'Lac Bangle'); fill(/^Description/, 'x'); fill(/^Price/, '10'); fill(/^Stock/, '1');
    fill(/^City/, 'Kota');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await new Promise(r => setTimeout(r, 400));
    expect(fetchMock.mock.calls.filter(c => c[0] === '/api/products')).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeTruthy();
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
    expect(JSON.parse(call[1].body)).toMatchObject({ name: 'Published Dish', status: 'APPROVED', cityId: 1 });
    expect(JSON.parse(call[1].body)).not.toHaveProperty('city');
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
  it('an admin can reassign the seller with the picker; the payload carries sellerId and workshopId', async () => {
    mount();
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
    fireEvent.change(screen.getByLabelText(/^Seller/), { target: { value: 'u-Shauk' } });
    fireEvent.change(screen.getByLabelText(/^Workshop/), { target: { value: 'w2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products/p2' && c[1]?.method === 'PATCH')!;
    expect(JSON.parse(call[1].body)).toMatchObject({ sellerId: 'u-Shauk', workshopId: 'w2' });
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
  it('shows the specific reason for a 403, or a generic message when the API gave none', async () => {
    mount();
    fetchMock.mockImplementation(() => res(403, {}));
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not have permission/i));
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
  const open = (role: 'admin' | 'seller' = 'admin') => { mount(role); fireEvent.click(screen.getByRole('button', { name: 'New post' })); };
  it('mandatory fields are required and wrapped for the red asterisk; optional ones are not', () => {
    open();
    for (const name of ['name', 'description', 'price', 'stock', 'category', 'city', 'status']) {
      const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement;
      expect(el.required).toBe(true);
      expect(el.closest('label')!.querySelector(':scope > .lbl')).toBeTruthy();
    }
    for (const name of ['workshopId', 'pickupLocation', 'sellerId']) expect((document.querySelector(`[name="${name}"]`) as HTMLInputElement).required).toBe(false);
  });
  it('the form has no seller-name or contact inputs any more', () => {
    open();
    for (const name of ['seller', 'artistName', 'phone', 'email', 'instagram', 'youtube']) expect(document.querySelector(`[name="${name}"]`)).toBeNull();
  });
  it('the workshop dropdown lists existing workshops plus "No workshop"; pickup location is a text field', () => {
    open();
    const sel = screen.getByLabelText(/^Workshop/) as HTMLSelectElement;
    expect(Array.from(sel.options).map(o => o.textContent)).toEqual(['No workshop', 'Beginner Crochet', 'Tote Bag Painting']);
    expect((screen.getByLabelText(/^Pickup location/) as HTMLInputElement).maxLength).toBe(200);
  });
});

describe('Profile dialog (public name and contact)', () => {
  it('an untouched city sends its cityId; clearing it sends no city fields (the server clears it)', async () => {
    const { ProfileDialog } = await import('@/components/ProfileDialog');
    const onSaved = vi.fn();
    fetchMock.mockImplementation(() => res(200, { userId: 'me', displayName: 'D' }));
    const body = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
    render(<ProfileDialog title="My profile" initial={{ userId: 'me', displayName: 'D', city: 'Jaipur', cityId: 2 }} url="/api/profile" onSaved={onSaved} onCancel={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(body()).toMatchObject({ cityId: 2 });
    for (const k of ['city', 'cityRef']) expect(body()).not.toHaveProperty(k);
    cleanup();
    render(<ProfileDialog title="My profile" initial={{ userId: 'me', displayName: 'D', city: 'Jaipur', cityId: 2 }} url="/api/profile" onSaved={onSaved} onCancel={() => undefined} />);
    fill(/^City/, '');
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    for (const k of ['city', 'cityId', 'cityRef']) expect(body()).not.toHaveProperty(k);
  });
  it('"Use my sign-in email" fills the public email (explicit opt-in); the field starts empty so nothing is published by accident', () => {
    mount('seller');
    act(() => { window.dispatchEvent(new Event('craftofy:open-profile')); });
    const email = screen.getByLabelText(/^Public email/) as HTMLInputElement;
    expect(email.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /Use my sign-in email/ }));
    expect(email.value).toBe('root@x.co');
    expect(screen.getAllByText(/shown publicly/i).length).toBeGreaterThan(0);
  });
  it('opens from "My profile", validates the phone pattern in the browser, PUTs /api/profile and toasts', async () => {
    mount('seller');
    act(() => { window.dispatchEvent(new Event('craftofy:open-profile')); });
    const phone = screen.getByLabelText(/^Public phone/) as HTMLInputElement;
    for (const bad of ['12345', '5989898999', 'abcdefghij']) { fireEvent.change(phone, { target: { value: bad } }); expect(phone.validity.patternMismatch).toBe(true); }
    for (const good of ['9989898999', '+91 99898 98999', '']) { fireEvent.change(phone, { target: { value: good } }); expect(phone.validity.patternMismatch).toBe(false); }
    expect((document.querySelector('[name="displayName"]') as HTMLInputElement).required).toBe(true);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => url === '/api/profile' && init?.method === 'PUT' ? res(200, { userId: 'me', displayName: 'New Studio' }) : url.startsWith('/api/places?') ? res(200, PLACES) : url === '/api/admin/products' ? res(200, db) : url === '/api/admin/artists' ? res(200, artistsOf(db)) : res(500, {}));
    fill(/^Display name/, 'New Studio'); fill(/^Public phone/, '99898 98999'); fill(/^Instagram/, 'newstudio'); await pickCity(); fill(/^About the artist/, 'Potter.\nBlue pottery.');
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/profile')!;
    expect(JSON.parse(call[1].body)).toEqual({ displayName: 'New Studio', publicPhone: '99898 98999', publicEmail: '', instagram: 'newstudio', youtube: '', bio: 'Potter.\nBlue pottery.', cityRef: 'REF-KOTA' });
    expect(screen.getByRole('status').textContent).toMatch(/Profile saved/);
  });
  it('a server error keeps the dialog open with the message', async () => {
    mount('seller');
    act(() => { window.dispatchEvent(new Event('craftofy:open-profile')); });
    fetchMock.mockImplementation(() => res(400, { error: 'publicPhone is invalid.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/publicPhone is invalid/));
    expect(screen.getByRole('dialog')).toBeTruthy();
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

describe('PostsAdmin as a seller', () => {
  it('has no Delete buttons, a seller heading, hides seller emails, and cannot choose Published', () => {
    mount('seller');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('My products');
    expect(screen.queryAllByRole('button', { name: /^Delete / })).toHaveLength(0);
    expect(document.body.textContent).not.toContain('@x.co');
    const sel = screen.getByLabelText('Change status for Draft Dish') as HTMLSelectElement;
    expect(Array.from(sel.options).find(o => o.value === 'APPROVED')!.disabled).toBe(true);
    expect(Array.from(sel.options).filter(o => !o.disabled).map(o => o.value)).toEqual(['DRAFT', 'ARCHIVED']);
  });
  it('a published row keeps Published as its disabled current value and allows Draft/Archived', () => {
    mount('seller');
    const sel = screen.getByLabelText('Change status for Boat Charm') as HTMLSelectElement;
    expect(sel.value).toBe('APPROVED');
    expect(Array.from(sel.options).filter(o => !o.disabled).map(o => o.value)).toEqual(['DRAFT', 'ARCHIVED']);
  });
  it('the new-post form offers only Draft/Archived (default Draft), no seller picker', () => {
    mount('seller'); fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    const status = screen.getByLabelText(/^Status/) as HTMLSelectElement;
    expect(Array.from(status.options).map(o => o.value)).toEqual(['DRAFT', 'ARCHIVED']);
    expect(status.value).toBe('DRAFT');
    expect(screen.queryByLabelText(/^Seller/)).toBeNull();
    expect(screen.getByText(/come from/i)).toBeTruthy();
  });
  it('editing a published post omits status from the PATCH and explains the re-review', async () => {
    mount('seller');
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /Edit/ }));
    expect(screen.queryByLabelText(/^Status/)).toBeNull();
    expect(screen.getByText(/back to Draft until an admin publishes it again/i)).toBeTruthy();
    fill(/^Title/, 'Boat Charm 2');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/products/p2' && c[1]?.method === 'PATCH')!;
    expect(JSON.parse(call[1].body)).not.toHaveProperty('status');
    expect(JSON.parse(call[1].body)).not.toHaveProperty('sellerId');
  });
  it('a 403 publish denial shows a red toast and makes no GET calls', async () => {
    mount('seller');
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'PATCH' ? res(403, { error: 'Only an admin can publish a product.' }) : res(200, []));
    fireEvent.change(screen.getByLabelText('Change status for Draft Dish'), { target: { value: 'ARCHIVED' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Only an admin can publish/));
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual(['/api/products/p3']);
  });
});

describe('PostsAdmin as an admin (seller info)', () => {
  it('shows the seller email on rows, the Seller picker in the form, and keeps Delete and Published', () => {
    mount('admin');
    expect(within(rowFor('Boat Charm')).getByText(/\(lake@x\.co\)/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Delete / }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    const picker = screen.getByLabelText(/^Seller/) as HTMLSelectElement;
    expect(Array.from(picker.options).map(o => o.textContent)).toEqual(['Me (admin) · Shelly Agarwal · root@x.co · 9989898999', 'Shauk and Stuff · shauk@x.co · 9989898999', 'Lake City Knots · lake@x.co', 'Lake City Knots · lake2@x.co · 9876543210']);
    expect(Array.from((screen.getByLabelText(/^Status/) as HTMLSelectElement).options).map(o => o.value)).toEqual(['APPROVED', 'DRAFT', 'ARCHIVED']);
  });
});

describe('creating a category from the product form', () => {
  const open = () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'New post' })); };
  it('lists the existing categories plus an "Add a new category" entry, default first category', () => {
    open();
    const sel = screen.getByLabelText(/^Category/) as HTMLSelectElement;
    expect(Array.from(sel.options).map(o => o.textContent)).toEqual([...CATEGORIES, '＋ Add a new category…']);
    expect(sel.value).toBe('Crochet & Textiles');
  });
  it('choosing "Add a new category" shows a name box; Add POSTs /api/categories, selects the new one and the product save sends it', async () => {
    open();
    await pickCity();
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: '__new__' } });
    const name = screen.getByLabelText(/^New category name/) as HTMLInputElement;
    expect(screen.getByRole('button', { name: 'Add category' }).hasAttribute('disabled')).toBe(true); // empty name
    fetchMock.mockImplementation((url: string, init?: RequestInit) => url === '/api/categories' && init?.method === 'POST' ? res(201, { name: 'Wooden Toys' }) : url === '/api/products' ? res(201, mk('p9', 'X', 'Me', 'DRAFT')) : url === '/api/admin/products' ? res(200, db) : url === '/api/admin/artists' ? res(200, artistsOf(db)) : res(500, {}));
    fireEvent.change(name, { target: { value: '  wooden toys ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    await waitFor(() => expect((screen.getByLabelText(/^Category/) as HTMLSelectElement).value).toBe('Wooden Toys'));
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/categories')![1].body)).toEqual({ name: 'wooden toys' });
    expect(screen.queryByLabelText(/^New category name/)).toBeNull();
    fill(/^Title/, 'Toy'); fill(/^Description/, 'x'); fill(/^Price/, '10'); fill(/^Stock/, '1');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/products')![1].body).category).toBe('Wooden Toys');
  });
  it('a category that already exists (API returns the stored spelling) is selected, not duplicated', async () => {
    open();
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: '__new__' } });
    fetchMock.mockImplementation(() => res(200, { name: 'Resin Art' }));
    fireEvent.change(screen.getByLabelText(/^New category name/), { target: { value: 'resin art' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    await waitFor(() => expect((screen.getByLabelText(/^Category/) as HTMLSelectElement).value).toBe('Resin Art'));
    expect(Array.from((screen.getByLabelText(/^Category/) as HTMLSelectElement).options).filter(o => o.value === 'Resin Art')).toHaveLength(1);
  });
  it('an API error is shown next to the field, keeps the typed name, and can be cancelled', async () => {
    open();
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: '__new__' } });
    fetchMock.mockImplementation(() => res(400, { error: 'name must be 2-40 characters' }));
    fireEvent.change(screen.getByLabelText(/^New category name/), { target: { value: '<b>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/2-40 characters/));
    expect((screen.getByLabelText(/^New category name/) as HTMLInputElement).value).toBe('<b>');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]); // the category panel's Cancel comes before the form's
    expect(screen.queryByLabelText(/^New category name/)).toBeNull();
    expect((screen.getByLabelText(/^Category/) as HTMLSelectElement).value).toBe('Crochet & Textiles');
  });
  it('Enter in the name box adds the category without submitting the whole form', async () => {
    open();
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: '__new__' } });
    fetchMock.mockImplementation(() => res(201, { name: 'Brass' }));
    fireEvent.change(screen.getByLabelText(/^New category name/), { target: { value: 'Brass' } });
    fireEvent.keyDown(screen.getByLabelText(/^New category name/), { key: 'Enter' });
    await waitFor(() => expect((screen.getByLabelText(/^Category/) as HTMLSelectElement).value).toBe('Brass'));
    expect(fetchMock.mock.calls.every(c => c[0] === '/api/categories')).toBe(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('sellers can add categories too', () => {
    mount('seller'); fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    expect(Array.from((screen.getByLabelText(/^Category/) as HTMLSelectElement).options).map(o => o.value)).toContain('__new__');
  });
});

describe('row detail view', () => {
  const full = () => {
    db = [mk('p1', 'Lily Bouquet', 'Shauk and Stuff', 'APPROVED', {
      description: 'A hand-crocheted bouquet that never wilts.', imageUrl: 'https://cdn.example.com/l.jpg', workshopId: 'w1', workshopTitle: 'Beginner Crochet',
      pickupLocation: 'Udaipur, Rajasthan', phone: '9989898999', email: 'hello@shauk.co', instagram: 'shaukandstuff', youtube: '@shauk',
      publishedByEmail: 'root@x.co', publishedAt: '2026-10-15T10:00:00.000Z', createdAt: '2026-10-14T08:00:00.000Z', updatedAt: '2026-10-15T10:00:00.000Z', sellerEmail: 'shauk@x.co',
    }), mk('p2', 'Bare Draft', 'Lake City Knots', 'DRAFT')];
  };
  const detail = () => screen.getByRole('dialog', { name: /Lily Bouquet|Bare Draft/ });
  it('clicking a row opens a dialog with every detail', () => {
    full(); mount();
    fireEvent.click(rowFor('Lily Bouquet'));
    const d = detail();
    const t = d.textContent!;
    for (const expected of ['Lily Bouquet', 'Published', 'Accessories', 'Jaipur', '₹850', '3 in stock', 'A hand-crocheted bouquet that never wilts.', 'Beginner Crochet', 'Udaipur, Rajasthan',
      'Shauk and Stuff', 'shauk@x.co', '9989898999', 'hello@shauk.co', 'shaukandstuff', '@shauk', 'root@x.co', 'p1'])
      expect(t).toContain(expected);
    expect(within(d).getByRole('img').getAttribute('src')).toBe('https://cdn.example.com/l.jpg');
    expect(within(d).getByRole('link', { name: /View public page/ }).getAttribute('href')).toBe('/products/lily-bouquet-p1');
    expect(t).toMatch(/Published.*(Oct|2026)/s);
  });
  it('empty values show a dash and drafts have no public page link', () => {
    full(); mount();
    fireEvent.click(rowFor('Bare Draft'));
    const d = detail();
    expect(within(d).queryByRole('link', { name: /View public page/ })).toBeNull();
    expect(within(d).getAllByText('—').length).toBeGreaterThanOrEqual(5);
    expect(d.textContent).toContain('Not published yet');
  });
  it('clicking the status dropdown, Edit, Delete or the public-page link in a row does not open it', () => {
    full(); mount();
    const row = rowFor('Lily Bouquet');
    fireEvent.click(within(row).getByLabelText('Change status for Lily Bouquet'));
    fireEvent.click(within(row).getByRole('button', { name: /^Delete/ }));
    expect(screen.queryByRole('dialog', { name: /Lily Bouquet/ })).toBeNull();
    fireEvent.click(within(rowFor('Lily Bouquet')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(rowFor('Lily Bouquet')).getByRole('button', { name: /^Edit/ }));
    expect(screen.getByRole('dialog', { name: /Edit post/ })).toBeTruthy(); // the edit form, not the detail view
    expect(screen.queryByRole('dialog', { name: /Lily Bouquet/ })).toBeNull();
  });
  it('the title is a real button so the keyboard and screen readers can open the details', () => {
    full(); mount();
    const open = within(rowFor('Lily Bouquet')).getByRole('button', { name: 'Lily Bouquet' });
    open.focus();
    fireEvent.click(open);
    expect(detail()).toBeTruthy();
  });
  it('Escape, the Close button and the backdrop close it, and focus returns to the row title', () => {
    full(); mount();
    const open = () => fireEvent.click(rowFor('Lily Bouquet'));
    open(); fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    open(); fireEvent.click(within(detail()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    open(); fireEvent.click(within(detail()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    open(); fireEvent.mouseDown(within(document.querySelector('.admin-modal') as HTMLElement).getByRole('dialog')); // a press inside the card must not close it
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.mouseDown(document.querySelector('.admin-modal')!); // a press on the backdrop closes it
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(within(rowFor('Lily Bouquet')).getByRole('button', { name: 'Lily Bouquet' }));
  });
  it('"Edit" inside the details opens the edit form for that post', () => {
    full(); mount();
    fireEvent.click(rowFor('Lily Bouquet'));
    fireEvent.click(within(detail()).getByRole('button', { name: /Edit/ }));
    expect(screen.getByRole('dialog', { name: /Edit post/ })).toBeTruthy();
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('Lily Bouquet');
  });
  it('stays in sync: after a status change the open details show the new status', async () => {
    full(); mount();
    fireEvent.click(rowFor('Lily Bouquet'));
    expect(detail().textContent).toContain('Published');
  });
  it('sellers see their own details too, without a Delete button', () => {
    full(); mount('seller');
    fireEvent.click(rowFor('Lily Bouquet'));
    expect(within(detail()).queryByRole('button', { name: /Delete/ })).toBeNull();
    expect(within(detail()).getByRole('button', { name: /Edit/ })).toBeTruthy();
  });
  it('the dialog traps focus: Tab from the last control wraps to the first', () => {
    full(); mount();
    fireEvent.click(rowFor('Lily Bouquet'));
    const items = Array.from(detail().querySelectorAll<HTMLElement>('a[href],button:not(:disabled)'));
    items[items.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(items[0]);
  });
});

describe('loaders', () => {
  const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
  const later = (status: number, body: unknown) => ({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

  it('a row status change shows the centred page loader (and disables the dropdown) until the request and the refresh finish', async () => {
    mount();
    const patch = deferred<Response>();
    const list = deferred<Response>();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => init?.method === 'PATCH' ? patch.promise : url === '/api/admin/products' ? list.promise : url === '/api/admin/artists' ? res(200, artistsOf(db)) : res(500, {}));
    fireEvent.change(screen.getByLabelText('Change status for Draft Dish'), { target: { value: 'ARCHIVED' } });
    await waitFor(() => expect(document.querySelector('.rr-page-loader')).toBeTruthy());
    const loader = document.querySelector('.rr-page-loader')!;
    expect(loader.textContent).toContain('Updating status');
    expect(loader.className).toContain('blocking');
    patch.resolve(later(200, { ...db[0], status: 'ARCHIVED' }));
    await waitFor(() => expect(document.querySelector('.rr-page-loader')?.textContent).toContain('Refreshing'));
    list.resolve(later(200, db));
    await waitFor(() => expect(document.querySelector('.rr-page-loader')).toBeNull());
  });
  it('the loader also goes away when the request fails', async () => {
    mount();
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'PATCH' ? res(400, { error: 'nope' }) : res(200, []));
    fireEvent.change(screen.getByLabelText('Change status for Draft Dish'), { target: { value: 'ARCHIVED' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/nope/));
    expect(document.querySelector('.rr-page-loader')).toBeNull();
  });
  it('the Save post button shows a busy ring on its right while the request is pending, and the form cannot be double-submitted', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    await pickCity();
    const post = deferred<Response>();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => init?.method === 'POST' ? post.promise : res(200, db));
    fill(/^Title/, 'T'); fill(/^Description/, 'x'); fill(/^Price/, '10'); fill(/^Stock/, '1');
    const save = screen.getByRole('button', { name: 'Save post' });
    expect(save.getAttribute('aria-busy')).not.toBe('true');
    fireEvent.click(save);
    const busy = await screen.findByRole('button', { name: /Saving/ });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    post.resolve(later(201, mk('p9', 'T', 'Me')));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('"Yes, delete" shows a busy ring while the delete is pending', async () => {
    mount();
    const del = deferred<Response>();
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => init?.method === 'DELETE' ? del.promise : res(200, db));
    fireEvent.click(within(rowFor('Boat Charm')).getByRole('button', { name: /^Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    const yes = await screen.findByRole('button', { name: /Yes, delete/ });
    expect(yes.getAttribute('aria-busy')).toBe('true');
    expect((yes as HTMLButtonElement).disabled).toBe(true);
    del.resolve(later(200, { ok: true }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Yes, delete/ })).toBeNull());
  });
  it('the profile Save button and the "Add category" button show a busy ring while pending', async () => {
    mount('seller');
    act(() => { window.dispatchEvent(new Event('craftofy:open-profile')); });
    const put = deferred<Response>();
    fetchMock.mockImplementation(() => put.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect((await screen.findByRole('button', { name: /Saving/ })).getAttribute('aria-busy')).toBe('true');
    put.resolve(later(400, { error: 'x' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    cleanup();
    mount(); fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: '__new__' } });
    const cat = deferred<Response>();
    fetchMock.mockImplementation(() => cat.promise);
    fireEvent.change(screen.getByLabelText(/^New category name/), { target: { value: 'Toys' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect((await screen.findByRole('button', { name: /Adding/ })).getAttribute('aria-busy')).toBe('true');
    cat.resolve(later(201, { name: 'Toys' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Adding/ })).toBeNull());
  });
});

describe('openNew (arrival via ?new=1)', () => {
  it('openNew opens the new post form immediately', () => {
    mountNew();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(/^Status/) as HTMLSelectElement).value).toBe('DRAFT');
  });
  it('without openNew the form stays closed', () => {
    mount();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('seller view still hides Delete and the seller picker and disables Published', () => {
    mountNew('seller');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByLabelText(/^Seller/)).toBeNull();
    const status = screen.getByLabelText(/^Status/) as HTMLSelectElement;
    expect(Array.from(status.options).map(o => o.value)).toEqual(['DRAFT', 'ARCHIVED']);
    expect(status.value).toBe('DRAFT');
    expect(screen.queryAllByRole('button', { name: /^Delete / })).toHaveLength(0);
    expect(document.body.textContent).not.toContain('@x.co');
    const sel = screen.getByLabelText('Change status for Draft Dish') as HTMLSelectElement;
    expect(Array.from(sel.options).find(o => o.value === 'APPROVED')!.disabled).toBe(true);
  });
  it('admin view unchanged', () => {
    mountNew('admin');
    expect(screen.getByLabelText(/^Seller/)).toBeTruthy();
    expect(Array.from((screen.getByLabelText(/^Status/) as HTMLSelectElement).options).map(o => o.value)).toEqual(['APPROVED', 'DRAFT', 'ARCHIVED']);
    expect(screen.getAllByRole('button', { name: /^Delete / }).length).toBeGreaterThan(0);
  });
  it('closing does not re-open the form', () => {
    mountNew();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New post' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('saving does not re-open the form', async () => {
    mountNew();
    await pickCity();
    fill(/^Title/, 'Fresh Pot'); fill(/^Description/, 'Hand made'); fill(/^Price/, '120'); fill(/^Stock/, '3');
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(rows().length).toBe(4));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('removes new=1 from the address so a refresh does not re-open it, keeping other params', () => {
    window.history.replaceState(null, '', '/dashboard/posts?new=1&x=2');
    mountNew();
    expect(window.location.search).toBe('?x=2');
    window.history.replaceState(null, '', '/');
  });
});

describe('wantsNewPost (page parsing)', () => {
  it('is true only for new=1', () => {
    expect(wantsNewPost({ new: '1' })).toBe(true);
    for (const v of [undefined, '0', '', 'true', ['1', '1']]) expect(wantsNewPost({ new: v })).toBe(false);
    expect(wantsNewPost({})).toBe(false);
  });
});
