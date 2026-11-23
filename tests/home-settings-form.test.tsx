// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { HomeSettingsForm } from '@/components/HomeSettingsForm';

const fetchMock = vi.fn();
beforeEach(() => { refresh.mockClear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const box = () => screen.getByLabelText(/products on the home page/i) as HTMLInputElement;

describe('HomeSettingsForm (Settings page)', () => {
  it('shows today\'s number, and the number box is required with the same bounds the server enforces', () => {
    render(<HomeSettingsForm initial={{ productLimit: 30 }} />);
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeTruthy();
    expect(box().value).toBe('30');
    expect([box().required, box().min, box().max, box().step]).toEqual([true, '4', '48', '1']);
    expect(screen.getByText('Right now the home page shows 30 products.')).toBeTruthy();
  });
  it('the browser itself refuses a number outside the bounds: nothing is sent', () => {
    render(<HomeSettingsForm initial={{ productLimit: 30 }} />);
    fireEvent.change(box(), { target: { value: '99' } });
    expect(box().validity.rangeOverflow).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('saves the number as a number to the admin route, refreshes the page and confirms with a toast', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ productLimit: 16 }) });
    render(<HomeSettingsForm initial={{ productLimit: 30 }} />);
    fireEvent.change(box(), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/home', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ productLimit: 16 }) })));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Home page settings saved'));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText('Right now the home page shows 16 products.')).toBeTruthy();
  });
  it('shows the server\'s message when saving fails, and does not claim it was saved', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'productLimit must be an integer between 4 and 48.' }) });
    render(<HomeSettingsForm initial={{ productLimit: 30 }} />);
    fireEvent.change(box(), { target: { value: '16' } }); // inside the browser's own bounds, so the request is sent and the server refuses it
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'productLimit must be an integer between 4 and 48.');
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText('Right now the home page shows 30 products.')).toBeTruthy();
  });
});
