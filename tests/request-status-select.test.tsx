// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const refresh = vi.hoisted(() => vi.fn());
const assign = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { RequestStatusSelect } from '@/components/RequestStatusSelect';

const fetchMock = vi.fn();
const sel = () => screen.getByLabelText('Status of Flow') as HTMLSelectElement;
const opts = () => Array.from(sel().options).map(o => o.textContent);
const base = { id: 'r1', title: 'Flow' };
const ok = (b: unknown = {}) => ({ ok: true, status: 200, json: async () => b });

beforeEach(() => {
  fetchMock.mockReset(); refresh.mockReset(); assign.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('request status dropdown', () => {
  it('offers Published, On hold and Archived; a request nobody has reviewed shows New', () => {
    render(<RequestStatusSelect request={{ ...base, status: 'received' }} />);
    expect(opts()).toEqual(['New', 'Published', 'On hold', 'Archived']);
    expect(sel().value).toBe('new');
    expect((sel().options[0] as HTMLOptionElement).disabled).toBe(true);
  });
  it('shows the status it has: On hold, Archived, or the listing status of a listed request', () => {
    const { unmount } = render(<RequestStatusSelect request={{ ...base, status: 'on_hold' }} />);
    expect(sel().value).toBe('on_hold'); unmount();
    const b = render(<RequestStatusSelect request={{ ...base, status: 'archived' }} />);
    expect(sel().value).toBe('archived'); b.unmount();
    const c = render(<RequestStatusSelect request={{ ...base, status: 'listed', listedWorkshopId: 'w1', listedStatus: 'APPROVED' }} />);
    expect(sel().value).toBe('published'); c.unmount();
    render(<RequestStatusSelect request={{ ...base, status: 'listed', listedWorkshopId: 'w1', listedStatus: 'DRAFT' }} />);
    expect(sel().value).toBe('on_hold');
  });
  it('On hold and Archived on a request save through the request status route and refresh the page', async () => {
    fetchMock.mockResolvedValue(ok());
    render(<RequestStatusSelect request={{ ...base, status: 'received' }} />);
    fireEvent.change(sel(), { target: { value: 'on_hold' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshop-requests/r1/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'on_hold' }) })));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(sel().value).toBe('on_hold');
    fireEvent.change(sel(), { target: { value: 'archived' } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/workshop-requests/r1/status', expect.objectContaining({ body: JSON.stringify({ status: 'archived' }) })));
  });
  it('Published on a request with no listing yet opens the listing form with Published preselected', () => {
    render(<RequestStatusSelect request={{ ...base, status: 'on_hold' }} />);
    fireEvent.change(sel(), { target: { value: 'published' } });
    expect(assign).toHaveBeenCalledWith('/dashboard/workshops?from=r1&status=APPROVED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('on a request that already has a listing the choice changes that listing: Published, On hold (Draft), Archived', async () => {
    fetchMock.mockResolvedValue(ok());
    render(<RequestStatusSelect request={{ ...base, status: 'listed', listedWorkshopId: 'w9', listedStatus: 'APPROVED' }} />);
    fireEvent.change(sel(), { target: { value: 'on_hold' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshops/w9/status', expect.objectContaining({ body: JSON.stringify({ status: 'DRAFT' }) })));
    fireEvent.change(sel(), { target: { value: 'archived' } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/workshops/w9/status', expect.objectContaining({ body: JSON.stringify({ status: 'ARCHIVED' }) })));
    fireEvent.change(sel(), { target: { value: 'published' } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/workshops/w9/status', expect.objectContaining({ body: JSON.stringify({ status: 'APPROVED' }) })));
  });
  it('a failure keeps the old value and says why under the dropdown', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'This request became a listing: change the listing instead.' }) });
    render(<RequestStatusSelect request={{ ...base, status: 'received' }} />);
    fireEvent.change(sel(), { target: { value: 'archived' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/became a listing/));
    expect(sel().value).toBe('new');
  });
});
