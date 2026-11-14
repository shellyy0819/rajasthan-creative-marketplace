// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SourcingTypesAdmin } from '@/components/SourcingTypesAdmin';
import type { AdminSourcingType } from '@/lib/types';

const row = (id: number, name: string, extra: Partial<AdminSourcingType> = {}): AdminSourcingType => ({ id, name, countsAsHandmade: false, showBadge: true, position: id, active: true, productCount: 0, ...extra });
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let list: AdminSourcingType[]; let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  list = [row(1, 'Handmade', { countsAsHandmade: true, showBadge: false, productCount: 5 }), row(2, 'Curated')];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const m = init?.method ?? 'GET';
    if (url === '/api/admin/sourcing-types' && m === 'GET') return res(200, list);
    if (url === '/api/admin/sourcing-types' && m === 'POST') { list = [...list, row(3, JSON.parse(String(init!.body)).name)]; return res(201, list[2]); }
    if (/\/2$/.test(url) && m === 'PATCH') { list = list.map(t => t.id === 2 ? { ...t, ...JSON.parse(String(init!.body)) } : t); return res(200, list[1]); }
    return res(404, { error: 'nope' });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('SourcingTypesAdmin', () => {
  it('lists each type with its product count; only an unused type can be deleted', () => {
    render(<SourcingTypesAdmin initial={list} />);
    const rows = screen.getAllByTestId('sourcing-row');
    expect(within(rows[0]).getByText('5 products')).toBeTruthy();
    expect(within(rows[0]).queryByRole('button', { name: 'Delete Handmade' })).toBeNull();
    expect(within(rows[1]).getByRole('button', { name: 'Delete Curated' })).toBeTruthy();
    expect((within(rows[0]).getByRole('button', { name: 'Move Handmade up' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('adds a type with the two switches and refreshes the list', async () => {
    render(<SourcingTypesAdmin initial={list} />);
    fireEvent.change(screen.getByLabelText('New type'), { target: { value: 'Upcycled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add type' }));
    await waitFor(() => expect(screen.getAllByTestId('sourcing-row')).toHaveLength(3));
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!;
    expect(JSON.parse(String(post[1].body))).toEqual({ name: 'Upcycled', countsAsHandmade: false, showBadge: true });
  });
  it('flipping "Counts as handmade" saves straight away', async () => {
    render(<SourcingTypesAdmin initial={list} />);
    const curated = screen.getAllByTestId('sourcing-row')[1];
    fireEvent.click(within(curated).getByLabelText('Counts as handmade'));
    await waitFor(() => expect(fetchMock.mock.calls.some(c => /\/2$/.test(c[0]) && JSON.parse(String(c[1].body)).countsAsHandmade === true)).toBe(true));
  });
  it('shows the server message when a change is refused', async () => {
    fetchMock.mockImplementationOnce(async () => res(409, { error: 'At least one sourcing type must stay active.' }));
    render(<SourcingTypesAdmin initial={list} />);
    fireEvent.click(within(screen.getAllByTestId('sourcing-row')[1]).getByRole('button', { name: 'Switch off' }));
    expect(await screen.findByText('At least one sourcing type must stay active.')).toBeTruthy();
  });
});
