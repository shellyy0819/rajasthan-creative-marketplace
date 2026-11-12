// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import { FairGame } from '@/components/fair/FairGame';
import { MirrorSheet, ShortlistSheet, StallSheet } from '@/components/fair/FairSheets';
import { STORE_KEY } from '@/components/fair/profile';
import { SAMPLE_MAKERS, sampleFairData } from '@/lib/fair-sample';
import type { FairData } from '@/lib/fair-types';

const fetchMock = vi.fn();
beforeEach(() => {
  localStorage.clear(); fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ visitors: [], count: 1 }) });
  vi.stubGlobal('fetch', fetchMock);
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext; // jsdom has no canvas: the engine then does nothing
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const play = async (data: FairData = sampleFairData()) => { render(<FairGame data={data} />); await screen.findByRole('heading', { name: 'Your player' }); };
const shownCode = () => screen.getByText(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/).textContent!;

describe('FairGame', () => {
  it('gives a new visitor a random code, a character, three quests and eight stalls', async () => {
    await play();
    expect(shownCode()).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    const quests = screen.getByRole('heading', { name: /today.s quests/i }).closest('section')!;
    expect(within(quests).getAllByRole('listitem')).toHaveLength(3);
    const makers = screen.getByRole('heading', { name: 'Makers at the fair' }).closest('section')!;
    expect(within(makers).getAllByRole('button')).toHaveLength(8);
    expect(within(makers).getAllByText('Open stall')).toHaveLength(8 - SAMPLE_MAKERS.length);
    expect(screen.getByText(/sample makers/i)).toBeTruthy();
    expect(screen.getByRole('application')).toBeTruthy();
  });
  it('remembers the code on this device', async () => {
    await play();
    const code = shownCode();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORE_KEY)!).current).toBe(code.replace('-', '')));
    cleanup();
    await play();
    expect(shownCode()).toBe(code);
  });
  it('plays with a typed code and a different code is a different character', async () => {
    await play();
    const before = screen.getByText(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/).closest('section')!.querySelector('.fair-name')!.textContent;
    fireEvent.change(screen.getByLabelText('Play with a code'), { target: { value: 'k7m-q4p' } });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(shownCode()).toBe('K7M-Q4P'));
    expect(screen.getByRole('status').textContent).toMatch(/You are now \w+, code K7M-Q4P/);
    expect(before).toBeTruthy();
  });
  it('explains a bad code', async () => {
    await play();
    const input = screen.getByLabelText('Play with a code'), play_ = screen.getByRole('button', { name: 'Play' });
    fireEvent.change(input, { target: { value: 'ABC' } }); fireEvent.click(play_);
    expect((await screen.findByRole('alert')).textContent).toMatch(/6 letters or numbers/);
    fireEvent.change(input, { target: { value: 'AB0O1L' } }); fireEvent.click(play_);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/never use O, I, L, 0 or 1/));
  });
  it('a new random code changes who you are', async () => {
    await play();
    const old = shownCode();
    fireEvent.click(screen.getByRole('button', { name: 'Get a new random code' }));
    await waitFor(() => expect(shownCode()).not.toBe(old));
  });
  it('tells the server where you are and shows how many people are here', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ visitors: [], count: 4 }) });
    await play();
    await waitFor(() => expect(screen.getByText(/4 people here now/)).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/fair/presence');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ code: shownCode().replace('-', ''), facing: 'up' });
  });
  it('sends an emote with the next heartbeat', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await play();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    fireEvent.click(screen.getByRole('button', { name: 'Wave' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    expect(fetchMock.mock.calls.some(c => JSON.parse(c[1].body).emote === 'wave')).toBe(true);
  });
  it('opens the shortlist, empty at first', async () => {
    await play();
    fireEvent.click(screen.getByRole('button', { name: /shortlist/i }));
    expect(await screen.findByText(/nothing here yet/i)).toBeTruthy();
  });
  it('says real stalls are real and sample ones are invented', async () => {
    await play({ source: 'real', makers: [] });
    expect(screen.getByText(/show sellers on Craftofy right now/i)).toBeTruthy();
  });
});

describe('StallSheet', () => {
  const m = SAMPLE_MAKERS[0];
  it('lists the counter, adds to the shortlist and the maker answers', () => {
    const onAdd = vi.fn();
    render(<StallSheet maker={m} real={false} shortlist={{ [m.items[0].key]: 2 }} onAdd={onAdd} onWatch={() => undefined} onOpenShortlist={() => undefined} onClose={() => undefined} />);
    expect(screen.getByText(m.greet)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(m.items.length);
    expect(screen.getByText('×2')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /add/i })[1]);
    expect(onAdd).toHaveBeenCalledWith(m.items[1]);
    expect(screen.getByText(m.thanks)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View product' })).toBeNull();
  });
  it('links real products to their pages', () => {
    const real = { ...m, href: '/artists/x', items: m.items.map(i => ({ ...i, href: `/products/${i.key}` })) };
    render(<StallSheet maker={real} real shortlist={{}} onAdd={() => undefined} onWatch={() => undefined} onOpenShortlist={() => undefined} onClose={() => undefined} />);
    expect(screen.getAllByRole('link', { name: 'View product' }).map(a => a.getAttribute('href'))).toEqual(m.items.map(i => `/products/${i.key}`));
    expect(screen.getByRole('link', { name: 'Artist page' }).getAttribute('href')).toBe('/artists/x');
  });
});

describe('ShortlistSheet', () => {
  it('totals the shortlist and changes quantities', () => {
    const onChange = vi.fn(), a = SAMPLE_MAKERS[0].items[1], data = sampleFairData();
    render(<ShortlistSheet data={data} shortlist={{ [a.key]: 2 }} onChange={onChange} onClose={() => undefined} />);
    expect(screen.getByText('₹440')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `One more ${a.name}` }));
    expect(onChange).toHaveBeenCalledWith(a.key, 1);
    expect(screen.getByText(/sample items, so nothing can be ordered/i)).toBeTruthy();
  });
});

describe('MirrorSheet', () => {
  const maker = SAMPLE_MAKERS[1], earrings = maker.items;
  const base = { maker, setView: vi.fn(), tryOn: null as string | null, onTry: vi.fn(), earrings, onAdd: vi.fn(), shortlist: {}, notes: [], onNote: vi.fn(), onSelfie: vi.fn(), paint: vi.fn(), onClose: vi.fn() };
  it('the menu offers the selfie, the note and the earrings', () => {
    render(<MirrorSheet {...base} view="menu" />);
    fireEvent.click(screen.getByRole('button', { name: /mirror selfie/i })); expect(base.setView).toHaveBeenCalledWith('selfie');
    fireEvent.click(screen.getByRole('button', { name: /feedback note/i })); expect(base.setView).toHaveBeenCalledWith('note');
    fireEvent.click(screen.getByRole('button', { name: earrings[0].name })); expect(base.onTry).toHaveBeenCalledWith(earrings[0].key);
  });
  it('offers to buy the earrings you are trying on', () => {
    render(<MirrorSheet {...base} view="menu" tryOn={earrings[1].key} />);
    fireEvent.click(screen.getByRole('button', { name: /add to shortlist · ₹240/i }));
    expect(base.onAdd).toHaveBeenCalledWith(earrings[1]);
  });
  it('hides the earrings option when the mirror stall sells none', () => {
    render(<MirrorSheet {...base} earrings={[]} view="menu" />);
    expect(screen.queryByText('Try on earrings')).toBeNull();
  });
  it('paints the selfie and records it once', () => {
    base.paint.mockClear(); base.onSelfie.mockClear();
    render(<MirrorSheet {...base} view="selfie" />);
    expect(base.paint).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 'smile');
    expect(base.onSelfie).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Change pose' }));
    expect(base.paint).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), 'wave');
  });
  it('needs a note before it pins one, then hands over the text and rating', () => {
    base.onNote.mockClear();
    render(<MirrorSheet {...base} view="note" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pin my note' }));
    expect(screen.getByRole('alert').textContent).toMatch(/write a few words/i);
    expect(base.onNote).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Your note'), { target: { value: '  Lovely fair  ' } });
    fireEvent.click(screen.getByRole('button', { name: '4 out of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin my note' }));
    expect(base.onNote).toHaveBeenCalledWith('Lovely fair', 4);
  });
});
