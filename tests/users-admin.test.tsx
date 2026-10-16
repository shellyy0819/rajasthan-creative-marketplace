// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { UsersAdmin } from '@/components/UsersAdmin';
import type { AdminUser } from '@/lib/types';

const U = (id: string, email: string, extra: Partial<AdminUser> = {}): AdminUser => ({
  id, email, name: email.split('@')[0], active: true, roles: [], createdAt: '2026-10-01T00:00:00.000Z', products: 0, workshops: 0, orders: 0, bookings: 0, ...extra,
});
let db: AdminUser[];
let fetchMock: ReturnType<typeof vi.fn>;
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  db = [U('1', 'root@x.co', { roles: ['admin'] }), U('2', 'seller@x.co', { roles: ['seller'], products: 2 }), U('3', 'buyer@x.co', { orders: 1 }), U('4', 'empty@x.co')];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/admin/users' && method === 'GET') return res(200, db);
    if (url === '/api/admin/users' && method === 'POST') {
      const b = JSON.parse(String(init!.body));
      if (db.some(u => u.email === b.email.toLowerCase())) return res(409, { error: 'User already exists.' });
      db = [...db, U('9', b.email.toLowerCase(), { roles: b.roles })]; return res(201, db[db.length - 1]);
    }
    const m = /^\/api\/admin\/users\/([^/]+)$/.exec(url);
    if (m && method === 'PATCH') { const i = db.findIndex(u => u.id === m[1]); db[i] = { ...db[i], ...JSON.parse(String(init!.body)) }; return res(200, db[i]); }
    if (m && method === 'DELETE') { db = db.filter(u => u.id !== m[1]); return res(200, { ok: true }); }
    if (/\/profile$/.test(url) && method === 'GET') return res(200, { userId: '2', displayName: 'Seller Studio', instagram: 'sellerstudio' });
    if (/\/profile$/.test(url) && method === 'PUT') return res(200, JSON.parse(String(init!.body)));
    return res(500, { error: 'unexpected ' + method + ' ' + url });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const mount = () => render(<UsersAdmin initialUsers={[...db]} currentEmail="root@x.co" />);
const row = (email: string) => screen.getAllByTestId('user-row').find(r => within(r).queryByText(email, { exact: false }))!;

describe('UsersAdmin', () => {
  it('lists users with role badges, counts and "(you)"; the add form marks email as required', () => {
    mount();
    expect(screen.getAllByTestId('user-row')).toHaveLength(4);
    expect(within(row('seller@x.co')).getAllByText('seller').length).toBeGreaterThan(0);
    expect(within(row('seller@x.co')).getByText(/2 products/)).toBeTruthy();
    expect(within(row('root@x.co')).getByText(/\(you\)/)).toBeTruthy();
    const email = document.querySelector('input[type="email"]') as HTMLInputElement;
    expect(email.required).toBe(true);
    expect(email.parentElement!.querySelector(':scope > .lbl')).toBeTruthy();
  });
  it('adds a user with the chosen roles (many-to-many: seller + admin together), toasts and reloads', async () => {
    mount();
    fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: 'New@X.co' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'admin' })); // tick admin as well as the default seller
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/new@x\.co added/));
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!;
    expect(JSON.parse(post[1].body)).toEqual({ email: 'New@X.co', roles: ['seller', 'admin'] });
    await waitFor(() => expect(screen.getAllByTestId('user-row')).toHaveLength(5));
  });
  it('a duplicate shows a red toast and does not re-fetch the list', async () => {
    mount();
    fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: 'seller@x.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/already exists/));
    expect(fetchMock.mock.calls.filter(c => (c[1]?.method ?? 'GET') === 'GET')).toHaveLength(0);
  });
  it('a failed add keeps what you typed; a successful add clears the form', async () => {
    mount();
    const email = document.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'seller@x.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(email.value).toBe('seller@x.co');
    fireEvent.change(email, { target: { value: 'fresh@x.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    await waitFor(() => expect(email.value).toBe(''));
  });
  it('toggling a role PATCHes the full role set', async () => {
    mount();
    fireEvent.click(within(row('buyer@x.co')).getByRole('checkbox', { name: 'seller role for buyer@x.co' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/admin/users/3' && c[1]?.method === 'PATCH')).toBe(true));
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)).toEqual({ roles: ['seller'] });
  });
  it('you cannot deactivate, delete or drop admin from yourself in the UI', () => {
    mount();
    const me = row('root@x.co');
    expect((within(me).getByRole('button', { name: /Deactivate root@x.co/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(me).getByRole('button', { name: /Delete root@x.co/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(me).getByRole('checkbox', { name: 'admin role for root@x.co' }) as HTMLInputElement).disabled).toBe(true);
  });
  it('deactivate sends active:false; delete asks for confirmation first and Cancel sends nothing', async () => {
    mount();
    fireEvent.click(within(row('seller@x.co')).getByRole('button', { name: /Deactivate seller@x.co/ }));
    await waitFor(() => expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')![1].body)).toEqual({ active: false }));
    fireEvent.click(within(row('empty@x.co')).getByRole('button', { name: /Delete empty@x.co/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'DELETE')).toBe(false);
    fireEvent.click(within(row('empty@x.co')).getByRole('button', { name: /Delete empty@x.co/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, delete/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0] === '/api/admin/users/4' && c[1]?.method === 'DELETE')).toBe(true));
  });
  it('a user who owns data has a delete button with a "deactivate instead" hint', () => {
    mount();
    expect(within(row('seller@x.co')).getByRole('button', { name: /Delete seller@x.co/ }).getAttribute('title')).toMatch(/deactivate instead/i);
  });
  it('the Profile button loads the seller profile and saves through the admin endpoint', async () => {
    mount();
    fireEvent.click(within(row('seller@x.co')).getByRole('button', { name: /Edit profile of seller@x.co/ }));
    await screen.findByRole('dialog');
    expect((screen.getByLabelText(/^Display name/) as HTMLInputElement).value).toBe('Seller Studio');
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fetchMock.mock.calls.some(c => c[0] === '/api/admin/users/2/profile' && c[1]?.method === 'PUT')).toBe(true);
  });
  it('users with no role have no Profile button', () => {
    mount();
    expect(within(row('buyer@x.co')).queryByRole('button', { name: /Edit profile/ })).toBeNull();
  });
});
