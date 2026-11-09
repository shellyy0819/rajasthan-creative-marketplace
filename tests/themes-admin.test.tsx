// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { ThemesAdmin } from '@/components/ThemesAdmin';
import type { ThemeDto } from '@/lib/themes/dto';
import { PRESETS } from '@/lib/themes/presets';

const dto = (id: number, preset: 'dhanteras' | 'diwali', state: ThemeDto['state'], extra: Partial<ThemeDto> = {}): ThemeDto => ({
  id, preset, label: PRESETS[preset].label, state, startsAtIst: '2026-11-05T06:00', endsAtIst: '2026-11-06T23:59',
  config: PRESETS[preset].config, effectivePrimary: PRESETS[preset].primary, updatedAt: '2026-11-01T00:00:00.000Z', ...extra,
});
const BASE: ThemeDto = dto(1, 'dhanteras', 'base', { preset: 'everyday' as never, label: 'Everyday', startsAtIst: null, endsAtIst: null, config: PRESETS.everyday.config, effectivePrimary: PRESETS.everyday.primary });
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let themes: ThemeDto[]; let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  themes = [dto(10, 'dhanteras', 'draft'), dto(11, 'diwali', 'live')];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const m = init?.method ?? 'GET';
    if (url === '/api/admin/themes' && m === 'GET') return res(200, { base: BASE, themes, live: 11 });
    if (url === '/api/admin/themes' && m === 'POST') { themes = [...themes, dto(12, 'dhanteras', 'draft')]; return res(201, themes[2]); }
    if (/\/schedule$/.test(url) && m === 'POST') return res(400, { error: 'Set a start and an end before scheduling.' });
    if (/\/end$/.test(url) && m === 'POST') { themes = themes.map(t => t.id === 11 ? { ...t, state: 'ended' } : t); return res(200, themes[1]); }
    if (/\/api\/admin\/themes\/10$/.test(url) && m === 'PATCH') return res(200, themes[0]);
    return res(500, { error: `unexpected ${m} ${url}` });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = () => render(<ThemesAdmin initialBase={BASE} initialThemes={[...themes]} publicOrigin="https://www.example.com" />);

describe('ThemesAdmin list', () => {
  it('shows Everyday plus each theme with its state and the right actions', () => {
    mount();
    expect(screen.getByTestId('theme-base')).toBeTruthy();
    const [draft, live] = screen.getAllByTestId('theme-row');
    expect(within(draft).getByRole('button', { name: 'Schedule Dhanteras' })).toBeTruthy();
    expect(within(draft).queryByRole('button', { name: /End/ })).toBeNull();
    expect(within(live).getByText('Live now')).toBeTruthy();
    expect(within(live).getByRole('button', { name: 'End Diwali now' })).toBeTruthy();
    expect(within(live).queryByRole('button', { name: /^Schedule/ })).toBeNull();
  });
  it('the new-theme select offers every preset except Everyday', () => {
    mount();
    const opts = within(screen.getByLabelText(/New theme from preset/)).getAllByRole('option').map(o => o.textContent);
    expect(opts).toContain('Dhanteras');
    expect(opts).not.toContain('Everyday');
  });
  it('shows the API error when scheduling is refused', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Dhanteras' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Set a start and an end'));
  });
  it('End now posts to the end route and refreshes the list', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'End Diwali now' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/themes/11/end', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(within(screen.getAllByTestId('theme-row')[1]).getByText('Ended')).toBeTruthy());
  });
  it('delete asks first', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Dhanteras' }));
    expect(screen.getByRole('group', { name: /Confirm delete Dhanteras/ })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ThemeEditor', () => {
  const open = () => { mount(); fireEvent.click(screen.getByRole('button', { name: 'Edit Dhanteras' })); };
  it('opens with the theme wording and limits, and saves config + IST dates', async () => {
    open();
    const banner = screen.getByLabelText('Banner line') as HTMLInputElement;
    expect(banner.maxLength).toBe(60);
    fireEvent.change(banner, { target: { value: 'Happy Dhanteras' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/themes/10', expect.objectContaining({ method: 'PATCH' })));
    const body = JSON.parse(String(fetchMock.mock.calls.find(c => c[0] === '/api/admin/themes/10')![1].body));
    expect(body.config.banner).toBe('Happy Dhanteras');
    expect(body.startsAtIst).toBe('2026-11-05T06:00');
  });
  it('disables Save and shows the ratio when the primary colour has too little contrast', () => {
    open();
    fireEvent.change(screen.getByLabelText('Primary colour'), { target: { value: '#777777' } });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/needs 4.5:1/)).toBeTruthy();
  });
  it('disables Save when the end is not after the start', () => {
    open();
    fireEvent.change(screen.getByLabelText('Ends (IST)'), { target: { value: '2026-11-05T05:00' } });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('The end must be after the start.')).toBeTruthy();
  });
  it('arrow keys move a focused sticker and + resizes it', () => {
    open();
    const halo = screen.getAllByRole('button').find(b => b.getAttribute('aria-label')?.startsWith('Marigold toran'))!;
    fireEvent.keyDown(halo, { key: 'ArrowRight' });
    fireEvent.keyDown(halo, { key: '+' });
    expect(halo.getAttribute('aria-label')).toMatch(/Marigold toran: 4, 0, size 1.1/);
  });
  it('unticking a sticker removes it from the preview', () => {
    open();
    fireEvent.click(screen.getByLabelText('Marigold toran'));
    expect(screen.getAllByRole('button').some(b => b.getAttribute('aria-label')?.startsWith('Marigold toran'))).toBe(false);
  });
});
