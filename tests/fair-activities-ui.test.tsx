// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { FairGame } from '@/components/fair/FairGame';
import { MarketSheet, SportsSheet } from '@/components/fair/FairActivities';
import { sampleFairData } from '@/lib/fair-sample';

const fetchMock = vi.fn();
const reply = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
beforeEach(() => {
  localStorage.clear(); fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: { body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (url === '/api/fair/claim') return reply(200, { code: body.code });
    if (url === '/api/fair/presence') return reply(200, { visitors: [], count: 1 });
    if (url === '/api/fair/quests/history') return reply(200, { days: [] });
    return reply(204, null);
  });
  vi.stubGlobal('fetch', fetchMock);
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); window.history.replaceState(null, '', '/fair'); });

const play = async (day?: string) => {
  window.history.replaceState(null, '', day ? `/fair?day=${day}` : '/fair');
  render(<FairGame data={sampleFairData()} />); await screen.findByRole('heading', { name: 'Your player' });
};

describe('FairGame: things to do at Pushkar', () => {
  it('lists the four activities during the mela', async () => {
    await play('2026-11-18');
    const card = screen.getByRole('heading', { name: 'Things to do at Pushkar' }).closest('section')!;
    for (const name of ['Hot air balloon rides', 'Folk music', 'Rural sports', 'Handicraft market']) expect(within(card).getByText(name)).toBeTruthy();
  });
  it('has no such card on an ordinary day', async () => {
    await play('2026-11-12');
    expect(screen.queryByRole('heading', { name: 'Things to do at Pushkar' })).toBeNull();
  });
  it('shows the music stage and the sports ring in the makers list', async () => {
    await play('2026-11-18');
    const makers = screen.getByRole('heading', { name: 'Makers at the fair' }).closest('section')!;
    expect(within(makers).getByText('Folk musicians on the stage')).toBeTruthy();
    expect(within(makers).getByText('Tug of war in the ring')).toBeTruthy();
    expect(within(makers).queryAllByText('Open stall')).toHaveLength(0);
  });
  it('opens the balloon ride and the handicraft market', async () => {
    await play('2026-11-18');
    fireEvent.click(screen.getByRole('button', { name: /Hot air balloon rides/ }));
    expect(screen.getByRole('button', { name: 'Take the ride' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take the ride' }));
    expect(screen.queryByRole('button', { name: 'Take the ride' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Handicraft market/ }));
    const dlg = screen.getByRole('dialog', { hidden: true });
    expect(within(dlg).getAllByRole('button', { name: 'Visit stall' })).toHaveLength(5);
  });
});

describe('MarketSheet', () => {
  it('lists every maker with a way to walk to the stall', () => {
    const onVisit = vi.fn(); render(<MarketSheet data={sampleFairData()} onVisit={onVisit} onShortlist={() => undefined} onClose={() => undefined} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Visit stall' })[2]);
    expect(onVisit).toHaveBeenCalledWith(2);
  });
});

describe('SportsSheet: tug of war', () => {
  it('is lost by standing still', () => {
    vi.useFakeTimers(); const done = vi.fn();
    render(<SportsSheet onFinish={done} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => { vi.advanceTimersByTime(11_000); });
    expect(done).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.getByText(/pulled you over/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy();
  });
  it('does not restart when the last tap on Pull lands as the game ends', () => {
    vi.useFakeTimers(); const done = vi.fn();
    render(<SportsSheet onFinish={done} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => { vi.advanceTimersByTime(11_000); });
    const again = screen.getByRole('button', { name: 'Play again' }) as HTMLButtonElement;
    expect(again.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(1300); });
    expect(again.disabled).toBe(false);
  });
  it('is won by pulling fast enough', () => {
    vi.useFakeTimers(); const done = vi.fn();
    render(<SportsSheet onFinish={done} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    for (let i = 0; i < 70 && !done.mock.calls.length; i++) {
      act(() => { vi.advanceTimersByTime(100); });
      const pull = screen.queryByRole('button', { name: 'Pull!' });
      if (pull && !done.mock.calls.length) fireEvent.click(pull);
      if (pull && !done.mock.calls.length) fireEvent.click(pull);
    }
    expect(done).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByText(/pulled the village team over/)).toBeTruthy();
  });
});
