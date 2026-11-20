// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { ShareSettingsForm } from '@/components/ShareSettingsForm';

const fetchMock = vi.fn();
beforeEach(() => { refresh.mockClear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ShareSettingsForm (Settings page)', () => {
  it('says who sees Share today: admins only by default', () => {
    render(<ShareSettingsForm initial={{ visibility: 'admin' }} />);
    expect(screen.getByRole('heading', { name: 'Sharing' })).toBeTruthy();
    expect((screen.getByLabelText(/who sees the share button/i) as HTMLSelectElement).value).toBe('admin');
    expect(screen.getByText(/right now only admins see the share button/i)).toBeTruthy();
  });
  it('saves "everyone" to the admin route, refreshes the page data and confirms with a toast', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ visibility: 'everyone' }) });
    render(<ShareSettingsForm initial={{ visibility: 'admin' }} />);
    fireEvent.change(screen.getByLabelText(/who sees the share button/i), { target: { value: 'everyone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/share', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ visibility: 'everyone' }) })));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Sharing settings saved'));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText(/right now every visitor sees the share button/i)).toBeTruthy();
  });
  it('shows the server\'s message when saving fails, and does not claim it was saved', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Admin access required.' }) });
    render(<ShareSettingsForm initial={{ visibility: 'admin' }} />);
    fireEvent.change(screen.getByLabelText(/who sees the share button/i), { target: { value: 'everyone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Admin access required.');
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText(/right now only admins see the share button/i)).toBeTruthy();
  });
});
