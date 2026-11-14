// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import { FairGame } from '@/components/fair/FairGame';
import { LookSheet, MirrorSheet, ShortlistSheet, StallSheet } from '@/components/fair/FairSheets';
import { STORE_KEY } from '@/components/fair/profile';
import { TOKEN_KEY } from '@/components/fair/identity';
import { MUTE_KEY } from '@/components/fair/sound';
import { SAMPLE_MAKERS, sampleFairData } from '@/lib/fair-sample';
import { stallsOf, makersOf } from '@/lib/fair-stalls';
import type { FairData } from '@/lib/fair-types';

const fetchMock = vi.fn();
let taken = new Set<string>(), presenceCount = 1, historyDays: unknown[] = [];
const reply = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
beforeEach(() => {
  localStorage.clear(); fetchMock.mockReset(); taken = new Set(); presenceCount = 1; historyDays = [];
  window.history.replaceState(null, '', '/fair');
  fetchMock.mockImplementation(async (url: string, init?: { body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (url === '/api/fair/claim') return taken.has(body.code) ? reply(409, { error: 'Code already taken.' }) : reply(200, { code: body.code });
    if (url === '/api/fair/presence') return reply(200, { visitors: [], count: presenceCount });
    if (url === '/api/fair/quests/history') return reply(200, { days: historyDays });
    if (url === '/api/fair/quests') return reply(204, null);
    if (url === '/api/fair/notes') return reply(201, { id: 1 });
    return reply(404);
  });
  vi.stubGlobal('fetch', fetchMock);
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext; // jsdom has no canvas: the engine then does nothing
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

// The toolbar buttons live in a burger menu that is closed by default; opening it (if needed) first.
const menuBtn = (name: string | RegExp) => {
  if (!document.getElementById('fair-menu')) fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  return screen.getByRole('button', { name });
};
const play = async (data: FairData = sampleFairData()) => { render(<FairGame data={data} />); await screen.findByRole('heading', { name: 'Your player' }); };
const shownCode = () => screen.getByText(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/).textContent!;
const claims = () => fetchMock.mock.calls.filter(c => c[0] === '/api/fair/claim').map(c => JSON.parse(c[1].body));
const typeCode = (v: string) => { fireEvent.change(screen.getByLabelText('Play with a code'), { target: { value: v } }); fireEvent.click(screen.getByRole('button', { name: 'Play' })); };

describe('FairGame: who is playing', () => {
  it('gives a new visitor a random code, claims it, and puts it in the address bar', async () => {
    await play();
    const code = shownCode();
    expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    await waitFor(() => expect(window.location.search).toBe(`?code=${code}`));
    const c = claims().at(-1);
    expect(c.code).toBe(code.replace('-', '')); expect(c.token).toMatch(/^[a-f0-9]{32}$/);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(c.token);
  });
  it('plays as the code in the link when it is free', async () => {
    window.history.replaceState(null, '', '/fair?code=k7m-q4p');
    await play();
    expect(shownCode()).toBe('K7M-Q4P');
    expect(window.location.search).toBe('?code=K7M-Q4P');
  });
  it('tells you when the code in the link is already taken, and gives a new one', async () => {
    taken.add('K7MQ4P');
    window.history.replaceState(null, '', '/fair?code=K7M-Q4P');
    await play();
    expect(shownCode()).not.toBe('K7M-Q4P');
    expect(await screen.findByText(/code in this link is already taken/i)).toBeTruthy();
  });
  it('remembers the code on this device', async () => {
    await play();
    const code = shownCode();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORE_KEY)!).current).toBe(code.replace('-', '')));
    cleanup(); window.history.replaceState(null, '', '/fair');
    await play();
    expect(shownCode()).toBe(code);
  });
  it('plays with a typed code and a different code is a different player', async () => {
    await play();
    typeCode('k7m-q4p');
    await waitFor(() => expect(shownCode()).toBe('K7M-Q4P'));
    expect(screen.getByRole('status').textContent).toMatch(/You are now \w+, code K7M-Q4P/);
    expect(window.location.search).toBe('?code=K7M-Q4P');
  });
  it('says "Code already taken" when someone else has the code you typed', async () => {
    await play();
    const mine = shownCode();
    taken.add('MMMMMM');
    typeCode('mmm-mmm');
    expect((await screen.findByRole('alert')).textContent).toBe('Code already taken. Try another one.');
    expect(shownCode()).toBe(mine);
  });
  it('explains a code that is the wrong shape', async () => {
    await play();
    typeCode('ABC');
    expect((await screen.findByRole('alert')).textContent).toMatch(/6 letters or numbers/);
    typeCode('AB0O1L');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/never use O, I, L, 0 or 1/));
  });
  it('a new random code changes who you are', async () => {
    await play();
    const old = shownCode();
    fireEvent.click(screen.getByRole('button', { name: 'Get a new random code' }));
    await waitFor(() => expect(shownCode()).not.toBe(old));
  });
  it('carries on playing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await play();
    expect(shownCode()).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  });
});

describe('FairGame: the fair', () => {
  it('shows the default stalls, three quests and the code\'s promise to remember', async () => {
    await play();
    const makers = screen.getByRole('heading', { name: 'Makers at the fair' }).closest('section')!;
    expect(within(makers).getAllByRole('button')).toHaveLength(8);
    for (const name of ['Rangili Dhaga', 'Resin Rang', 'Kaath Ghar', 'Bandhej Boutique', 'Noel Nest']) expect(within(makers).getByText(name)).toBeTruthy();
    expect(within(makers).getAllByText('Open stall')).toHaveLength(3);
    const quests = screen.getByRole('heading', { name: /today.s quests/i }).closest('section')!;
    expect(within(quests).getAllByRole('listitem')).toHaveLength(3);
    expect(within(quests).getByText(/saved under your code/i)).toBeTruthy();
    expect(screen.getByText(/sample makers/i)).toBeTruthy();
  });
  it('names the open stalls after the categories they wait for when sellers are live', async () => {
    const stalls = [{ maker: SAMPLE_MAKERS[0], label: 'Handmade crochet' }, { maker: null, label: 'Wood craft' }, ...stallsOf([]).slice(2)];
    await play({ source: 'real', stalls, makers: makersOf(stalls) });
    expect(screen.getByText('Open: Wood craft')).toBeTruthy();
    expect(screen.getByText(/waiting for a wood craft maker/i)).toBeTruthy();
    expect(screen.getByText(/show sellers on Craftofy right now/i)).toBeTruthy();
  });
  it('tells the server where you are, with your secret, and shows how many are here', async () => {
    presenceCount = 4;
    await play();
    await waitFor(() => expect(screen.getByText(/4 people here now/)).toBeTruthy());
    const call = fetchMock.mock.calls.find(c => c[0] === '/api/fair/presence')!;
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toMatchObject({ code: shownCode().replace('-', ''), facing: 'up', token: expect.stringMatching(/^[a-f0-9]{32}$/) });
  });
  it('sends an emote with the next heartbeat', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await play();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    fireEvent.click(screen.getByRole('button', { name: 'Wave' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2600); });
    expect(fetchMock.mock.calls.some(c => c[0] === '/api/fair/presence' && JSON.parse(c[1].body).emote === 'wave')).toBe(true);
  });
  it('opens the shortlist, empty at first', async () => {
    await play();
    fireEvent.click(menuBtn(/shortlist/i));
    expect(await screen.findByText(/nothing here yet/i)).toBeTruthy();
  });
  it('brings back earlier days of quests saved under the code', async () => {
    historyDays = [{ day: '2026-11-10', quests: [{ id: 'meet3', title: 'Meet 3 makers', target: 3 }, { id: 'craft', title: 'Watch a maker at work', target: 1 }], progress: { meet3: ['a', 'b', 'c'] }, updatedAt: '2026-11-10T10:00:00.000Z' }];
    await play();
    const summary = await screen.findByText(/Earlier days \(1\)/);
    expect(summary.textContent).toMatch(/1 quests done in all/);
    expect(screen.getByText(/1 of 2 done/)).toBeTruthy();
    expect(screen.getByText(/✓ Meet 3 makers · ○ Watch a maker at work/)).toBeTruthy();
  });
});

describe('FairGame: look, sound, full screen and panel', () => {
  it('lets you pick one of five female and five male looks, and others see it', async () => {
    await play();
    fireEvent.click(screen.getByRole('button', { name: 'My look' }));
    const dialog = await screen.findByRole('dialog');
    const groups = within(dialog).getAllByRole('group');
    expect(groups.map(g => within(g).getAllByRole('button').length)).toEqual([5, 5]);
    expect(within(dialog).getByText('Female')).toBeTruthy(); expect(within(dialog).getByText('Male')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Veer' }));
    expect(await screen.findByText(/You now look like Veer/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Veer' }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORE_KEY)!).profiles[shownCode().replace('-', '')].look).toBe('m1'));
    expect(screen.getAllByText('Veer').length).toBeGreaterThan(0);
  });
  it('can go back to the look the code starts with', async () => {
    await play();
    fireEvent.click(screen.getByRole('button', { name: 'My look' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /starting look/i })).toBeNull();
    const other = within(dialog).getAllByRole('button').find(b => b.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(other);
    fireEvent.click(await within(dialog).findByRole('button', { name: /back to my starting look/i }));
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: /starting look/i })).toBeNull());
  });
  it('turns the sound off and remembers it', async () => {
    await play();
    const btn = menuBtn('Sound: on');
    fireEvent.click(btn);
    await waitFor(() => expect(localStorage.getItem(MUTE_KEY)).toBe('1'));
    expect(menuBtn('Sound: off')).toBeTruthy();
    expect(localStorage.getItem(MUTE_KEY)).toBe('1');
    cleanup(); await play();
    expect(menuBtn('Sound: off')).toBeTruthy();
  });
  it('hides and shows the side panel', async () => {
    await play();
    const panel = document.getElementById('fair-panel')!;
    expect(panel.hidden).toBe(false);
    fireEvent.click(menuBtn('Hide panel'));
    expect(panel.hidden).toBe(true);
    fireEvent.click(menuBtn('Show panel'));
    expect(panel.hidden).toBe(false);
  });
  it('switches between following you and the overview', async () => {
    await play();
    fireEvent.click(menuBtn('Overview'));
    expect(menuBtn('Follow me').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(menuBtn('Follow me'));
    expect(menuBtn('Overview')).toBeTruthy();
  });
  it('goes full screen with the panel folded away, and Escape leaves it', async () => {
    await play();
    const fair = document.querySelector('.fair')!;
    expect(fair.classList.contains('is-full')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    await waitFor(() => expect(fair.classList.contains('is-full')).toBe(true));
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeTruthy();
    expect(document.getElementById('fair-panel')!.hidden).toBe(true);
    fireEvent.click(menuBtn('Show panel'));
    expect(document.getElementById('fair-panel')!.hidden).toBe(false);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(fair.classList.contains('is-full')).toBe(false));
    expect(document.getElementById('fair-panel')!.hidden).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
  it('the Exit button also leaves full screen', async () => {
    await play();
    const fair = document.querySelector('.fair')!;
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    await waitFor(() => expect(fair.classList.contains('is-full')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
    await waitFor(() => expect(fair.classList.contains('is-full')).toBe(false));
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
    const onChange = vi.fn(), a = SAMPLE_MAKERS[0].items[1];
    render(<ShortlistSheet data={sampleFairData()} shortlist={{ [a.key]: 2 }} onChange={onChange} onClose={() => undefined} />);
    expect(screen.getByText('₹440')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `One more ${a.name}` }));
    expect(onChange).toHaveBeenCalledWith(a.key, 1);
    expect(screen.getByText(/sample items, so nothing can be ordered/i)).toBeTruthy();
  });
});

describe('MirrorSheet', () => {
  const maker = SAMPLE_MAKERS.find(m => m.mirror)!, wearables = maker.items;
  const base = { maker, setView: vi.fn(), tryOn: null as string | null, onTry: vi.fn(), wearables, onAdd: vi.fn(), shortlist: {}, notes: [], onNote: vi.fn(async () => null as string | null), onSelfie: vi.fn(), onShutter: vi.fn(), paint: vi.fn(), onClose: vi.fn() };
  it('the menu offers the selfie, the note and something to try on', () => {
    render(<MirrorSheet {...base} view="menu" />);
    fireEvent.click(screen.getByRole('button', { name: /mirror selfie/i })); expect(base.setView).toHaveBeenCalledWith('selfie');
    fireEvent.click(screen.getByRole('button', { name: /feedback note/i })); expect(base.setView).toHaveBeenCalledWith('note');
    fireEvent.click(screen.getByRole('button', { name: wearables[0].name })); expect(base.onTry).toHaveBeenCalledWith(wearables[0].key);
  });
  it('offers to buy what you are trying on', () => {
    render(<MirrorSheet {...base} view="menu" tryOn={wearables[1].key} />);
    fireEvent.click(screen.getByRole('button', { name: /add to shortlist · ₹1,650/i }));
    expect(base.onAdd).toHaveBeenCalledWith(wearables[1]);
  });
  it('hides the try-on option when nothing at the mirror stall can be worn', () => {
    render(<MirrorSheet {...base} wearables={[]} view="menu" />);
    expect(screen.queryByText('Try something on')).toBeNull();
  });
  it('paints the selfie, clicks the shutter each time and records it once', () => {
    base.paint.mockClear(); base.onSelfie.mockClear(); base.onShutter.mockClear();
    render(<MirrorSheet {...base} view="selfie" />);
    expect(base.paint).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 'smile');
    expect(base.onSelfie).toHaveBeenCalledTimes(1); expect(base.onShutter).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Take another' }));
    expect(base.onShutter).toHaveBeenCalledTimes(2); expect(base.onSelfie).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Change pose' }));
    expect(base.paint).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), 'wave');
  });
  it('needs a note before it sends one, then hands over the text and rating', async () => {
    base.onNote.mockClear();
    render(<MirrorSheet {...base} view="note" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send my note' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/write a few words/i);
    expect(base.onNote).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Your note'), { target: { value: '  Lovely fair  ' } });
    fireEvent.click(screen.getByRole('button', { name: '4 out of 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send my note' }));
    await waitFor(() => expect(base.onNote).toHaveBeenCalledWith('Lovely fair', 4));
    await waitFor(() => expect(base.setView).toHaveBeenCalledWith('menu'));
  });
  it('shows the problem and keeps the note when sending fails', async () => {
    const setView = vi.fn(), onNote = vi.fn(async () => 'Network error. Your note was not sent, please try again.');
    render(<MirrorSheet {...base} setView={setView} onNote={onNote} view="note" />);
    fireEvent.change(screen.getByLabelText('Your note'), { target: { value: 'Great stalls' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send my note' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/not sent/);
    expect((screen.getByLabelText('Your note') as HTMLTextAreaElement).value).toBe('Great stalls');
    expect(setView).not.toHaveBeenCalledWith('menu');
  });
});

describe('LookSheet', () => {
  it('shows five female and five male looks and reports the pick', () => {
    const onPick = vi.fn();
    render(<LookSheet current="f1" startsWith="f1" onPick={onPick} onClose={() => undefined} />);
    expect(screen.getAllByRole('button').filter(b => b.hasAttribute('aria-pressed'))).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Rudra' }));
    expect(onPick).toHaveBeenCalledWith('m4');
    expect(screen.getByRole('button', { name: 'Tara' }).getAttribute('aria-pressed')).toBe('true');
  });
});
