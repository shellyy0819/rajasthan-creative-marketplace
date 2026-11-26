// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrendSettingsForm } from '@/components/TrendSettingsForm';
import type { TrendSettingsView } from '@/lib/trend-settings';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const EMPTY: TrendSettingsView = { keySet: false, model: 'gemini-test-1.5', region: '', source: 'none', hasStoredRow: false };
const SAVED: TrendSettingsView = { keySet: true, keyHint: '1234', model: 'gemini-test-1.5', region: 'Some region', source: 'saved', hasStoredRow: true };
const keyBox = () => screen.getByLabelText(/gemini api key/i) as HTMLInputElement;

describe('TrendSettingsForm (Settings page)', () => {
  it('asks for a key when none is saved, and says where it comes from', () => {
    render(<TrendSettingsForm initial={EMPTY} />);
    expect(screen.getByRole('heading', { name: /market trends/i })).toBeTruthy();
    expect(screen.getByText(/no key is saved/i)).toBeTruthy();
    expect(screen.getByText(/google ai studio/i)).toBeTruthy();
    expect(keyBox().required).toBe(true);
    expect(keyBox().type).toBe('password');
    expect((screen.getByLabelText(/^model/i) as HTMLInputElement).value).toBe('gemini-test-1.5');
    expect(screen.getByText(/leave empty to use the cities listed on the site/i)).toBeTruthy();
  });
  it('shows only the last 4 characters of a saved key and never an input value for it', () => {
    render(<TrendSettingsForm initial={SAVED} />);
    expect(screen.getByText(/key saved, ends in 1234/i)).toBeTruthy();
    expect(keyBox().value).toBe('');
    expect(keyBox().required).toBe(false);
    expect(keyBox().placeholder).toMatch(/leave empty to keep/i);
    expect((screen.getByLabelText(/region/i) as HTMLInputElement).value).toBe('Some region');
    expect(document.body.innerHTML).not.toMatch(/value="[^"]*1234/);
  });
  it('says so when the key comes from the server environment', () => {
    render(<TrendSettingsForm initial={{ ...EMPTY, keySet: true, keyHint: '7890', source: 'environment' }} />);
    expect(screen.getByText(/gemini_api_key/i)).toBeTruthy();
    expect(screen.getByText(/ends in 7890/i)).toBeTruthy();
    expect(keyBox().required).toBe(false); // model and region can be saved with the environment key
    expect(keyBox().placeholder).toMatch(/environment/i);
    expect(screen.getByText(/can be left empty/i)).toBeTruthy();
  });
  it('shows Remove whenever a settings row exists, even when its key cannot be read, and not when there is none', () => {
    const { unmount } = render(<TrendSettingsForm initial={{ ...EMPTY, hasStoredRow: true }} />);
    expect(screen.getByRole('button', { name: /remove saved settings/i })).toBeTruthy();
    unmount();
    render(<TrendSettingsForm initial={{ ...EMPTY, keySet: true, keyHint: '7890', source: 'environment', hasStoredRow: true }} />);
    expect(screen.getByRole('button', { name: /remove saved settings/i })).toBeTruthy();
    cleanup();
    render(<TrendSettingsForm initial={{ ...EMPTY, keySet: true, keyHint: '7890', source: 'environment', hasStoredRow: false }} />);
    expect(screen.queryByRole('button', { name: /remove saved settings/i })).toBeNull();
  });
  it('saves model and region without a key when the environment key is in use', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ...EMPTY, keySet: true, keyHint: '7890', source: 'environment', hasStoredRow: true, model: 'model-fixed' }) });
    render(<TrendSettingsForm initial={{ ...EMPTY, keySet: true, keyHint: '7890', source: 'environment' }} />);
    fireEvent.change(screen.getByLabelText(/^model/i), { target: { value: 'model-fixed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/trends', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ apiKey: '', model: 'model-fixed', region: '' }),
    })));
    expect(await screen.findByRole('button', { name: /remove saved settings/i })).toBeTruthy();
  });
  it('sends the typed key, shows the server view afterwards with the key box empty, and confirms with a toast', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => SAVED });
    render(<TrendSettingsForm initial={EMPTY} />);
    fireEvent.change(keyBox(), { target: { value: 'AIzaSyTestKey1234' } });
    fireEvent.change(screen.getByLabelText(/region/i), { target: { value: 'Some region' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/trends', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ apiKey: 'AIzaSyTestKey1234', model: 'gemini-test-1.5', region: 'Some region' }),
    })));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('saved'));
    expect(screen.getByText(/key saved, ends in 1234/i)).toBeTruthy();
    expect(keyBox().value).toBe('');
  });
  it('marks Save busy while the request is pending', async () => {
    let finish: (v: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise(r => { finish = r; }));
    render(<TrendSettingsForm initial={SAVED} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.getAttribute('aria-busy')).toBe('false');
    fireEvent.click(save);
    await waitFor(() => expect(save.getAttribute('aria-busy')).toBe('true'));
    expect((save as HTMLButtonElement).disabled).toBe(true);
    finish({ ok: true, json: async () => SAVED });
    await waitFor(() => expect(save.getAttribute('aria-busy')).toBe('false'));
  });
  it('shows the server\'s message inline when saving fails, and keeps the old state', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'model must be a Gemini model id.' }) });
    render(<TrendSettingsForm initial={SAVED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'model must be a Gemini model id.');
    expect(screen.getByText(/key saved, ends in 1234/i)).toBeTruthy();
  });
  it('removes the saved settings after a confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    fetchMock.mockResolvedValue({ ok: true, json: async () => EMPTY });
    render(<TrendSettingsForm initial={SAVED} />);
    fireEvent.click(screen.getByRole('button', { name: /remove saved settings/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings/trends', expect.objectContaining({ method: 'DELETE' })));
    expect(await screen.findByText(/no key is saved/i)).toBeTruthy();
  });
});
