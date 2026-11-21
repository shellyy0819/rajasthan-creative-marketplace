// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const events = vi.hoisted(() => [] as { name: string; params: Record<string, unknown> }[]);
vi.mock('@/lib/analytics', () => ({ gaEvent: (name: string, params: Record<string, unknown> = {}) => { events.push({ name, params }); } }));
vi.mock('next/link', () => ({ default: ({ href, children, onClick, ...r }: any) => <a href={href} onClick={e => { e.preventDefault(); onClick?.(e); }} {...r}>{children}</a> }));
const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh, push: vi.fn() }), usePathname: () => '/' }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { email: 'v@x.co' } }, status: 'authenticated' }), signIn: vi.fn() }));

import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { ClassDetail } from '@/components/class/ClassDetail';
import { CraftDetail } from '@/components/class/CraftDetail';
import { LiveCatalog } from '@/components/LiveCatalog';
import { ReserveButton } from '@/components/ReserveButton';
import { StoreProvider, useStore } from '@/components/StoreProvider';
import { TrackWorkshopView } from '@/components/TrackWorkshopView';
import { WorkshopCard } from '@/components/WorkshopCard';
import { WorkshopContact } from '@/components/WorkshopContact';
import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { gaHostForm, gaReserve, gaSelectWorkshop, gaViewWorkshop, gaWorkshopContact, gaWorkshopList, gaWorkshopType } from '@/lib/ga-events';
import type { Workshop } from '@/lib/types';

const names = () => events.map(e => e.name);
const last = (name: string) => [...events].reverse().find(e => e.name === name)?.params;
beforeEach(() => {
  events.length = 0; nav.refresh.mockReset();
  // jsdom has no <dialog> methods (the booking dialog is mounted by the store provider)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** Invented listings: nothing here is real data. */
const cls = { id: 'w4', title: 'Sunrise Vinyasa', type: 'FREE', pricePaise: 0, kind: 'class', mode: 'online', topicId: 1, topic: { id: 1, name: 'Yoga', slug: 'yoga' }, city: null, venue: null, date: '2099-01-05', time: '06:30', endsOn: null,
  seats: null, booked: 0, host: 'Anaya', description: 'A calm hour.', status: 'APPROVED', platform: 'Zoom', schedule: { repeat: 'weekly', days: ['mon', 'wed'], time: '06:30', durationMin: 60 }, languages: [], images: [], prices: [],
  whatsapp: '+919989898999', instagram: 'anaya.yoga', website: 'https://anaya.example', publicPhone: '+919989898999', freeTrial: false } as unknown as Workshop;
const event = { ...cls, id: 'w9', title: 'Lac Craft', kind: 'workshop', mode: 'in_person', type: 'PAID', pricePaise: 30000, seats: 8, booked: 2, city: 'Jodhpur', venue: 'Studio 9', topic: { id: 2, name: 'Craft', slug: 'craft' }, schedule: undefined, platform: undefined, makes: [], included: [], bring: [], minAge: null } as unknown as Workshop;

describe('the event helpers', () => {
  it('say class or workshop', () => {
    expect(gaWorkshopType({ kind: 'class', mode: 'online' })).toBe('class');
    expect(gaWorkshopType({ kind: 'workshop', mode: 'online' })).toBe('class');
    expect(gaWorkshopType({ kind: 'popup', mode: 'in_person' })).toBe('workshop');
  });
  it('view_item and select_item carry the id, the topic and the type, and nothing private', () => {
    gaViewWorkshop({ workshopId: 'w4', category: 'Yoga', contentType: 'class' });
    gaSelectWorkshop({ workshopId: 'w4', category: 'Yoga', contentType: 'class' });
    expect(events).toEqual([
      { name: 'view_item', params: { item_id: 'w4', content_type: 'class', item_category: 'Yoga' } },
      { name: 'select_item', params: { item_id: 'w4', item_list_id: 'workshops', item_list_name: 'workshops', content_type: 'class', item_category: 'Yoga' } },
    ]);
  });
  it('a contact fires contact_seller and the method event, with the workshop id and where the button was', () => {
    gaWorkshopContact({ workshopId: 'w4', method: 'website', placement: 'bar', category: 'Yoga', contentType: 'class' });
    expect(names()).toEqual(['contact_seller', 'contact_website']);
    expect(events[1].params).toEqual({ workshop_id: 'w4', contact_method: 'website', content_type: 'class', placement: 'bar', item_category: 'Yoga' });
    events.length = 0;
    for (const m of ['whatsapp', 'call', 'instagram'] as const) gaWorkshopContact({ workshopId: 'w4', method: m, placement: 'card', contentType: 'class' });
    expect(names()).toEqual(['contact_seller', 'contact_whatsapp', 'contact_seller', 'contact_call', 'contact_seller', 'contact_instagram']);
  });
  it('the list event reports the filters in use; a changed filter adds filter_change and new search text adds search', () => {
    gaWorkshopList({ filters: { city: 'jaipur', q: 'yoga' }, count: 3 });
    expect(names()).toEqual(['view_item_list', 'search']);
    expect(events[0].params).toEqual({ item_list_id: 'workshops', item_list_name: 'workshops', item_count: 3, city: 'jaipur' });
    expect(events[1].params).toEqual({ search_term: 'yoga', item_list_id: 'workshops' });
    events.length = 0;
    gaWorkshopList({ filters: { city: 'udaipur', q: 'yoga' }, previous: { city: 'jaipur', q: 'yoga' }, count: 1 });
    expect(names()).toEqual(['view_item_list', 'filter_change']); // the same search text is not a new search
    events.length = 0;
    gaWorkshopList({ filters: { city: 'udaipur', q: 'pottery' }, previous: { city: 'udaipur', q: 'yoga' }, count: 0 });
    expect(names()).toEqual(['view_item_list', 'search']); // only the text changed
    events.length = 0;
    gaWorkshopList({ filters: {}, count: 5 });
    expect(names()).toEqual(['view_item_list']);
  });
  it('the booking and host form events carry ids and counts only', () => {
    gaReserve('open', { workshopId: 'w9', free: false });
    gaReserve('complete', { workshopId: 'w9', seats: 2, free: false });
    gaReserve('error', { workshopId: 'w9', seats: 2 });
    gaHostForm('open', { path: 'class' }); gaHostForm('step', { path: 'class', step: 2 }); gaHostForm('submit', { path: 'class' });
    expect(events.map(e => [e.name, e.params])).toEqual([
      ['reserve_open', { workshop_id: 'w9', price_type: 'paid' }],
      ['reserve_complete', { workshop_id: 'w9', seats: 2, price_type: 'paid' }],
      ['reserve_error', { workshop_id: 'w9', seats: 2 }],
      ['host_form_open', { form_path: 'class' }], ['host_form_step', { form_path: 'class', step_number: 2 }], ['host_form_submit', { form_path: 'class' }],
    ]);
  });
});

describe('the detail page', () => {
  it('reports view_item once, even when it re-renders', () => {
    const { rerender } = render(<TrackWorkshopView workshopId="w4" category="Yoga" contentType="class" />);
    rerender(<TrackWorkshopView workshopId="w4" category="Yoga" contentType="class" />);
    expect(names()).toEqual(['view_item']);
    expect(last('view_item')).toMatchObject({ item_id: 'w4', item_category: 'Yoga', content_type: 'class' });
  });
  it('the online class page reports its contact buttons with where they sit (page, and the phone bar)', () => {
    const { container } = render(<ClassDetail w={cls} ended={false} now={new Date('2099-01-01T00:00:00Z')} />);
    const primary = container.querySelector('.cd-cta a.primary')!;
    fireEvent.click(primary);
    expect(names()).toEqual(['contact_seller', 'contact_whatsapp']);
    expect(last('contact_whatsapp')).toMatchObject({ workshop_id: 'w4', placement: 'page', content_type: 'class', item_category: 'Yoga' });
    events.length = 0;
    fireEvent.click(container.querySelector('.cd-aside a.primary')!);
    expect(last('contact_whatsapp')).toMatchObject({ placement: 'bar' });
    events.length = 0;
    fireEvent.click(container.querySelector('.cd-icons a[aria-label]')!);
    expect(names()[1]).toMatch(/^contact_(instagram|website|call)$/);
    expect(last(names()[1])).toMatchObject({ placement: 'page' });
  });
  it('a middle click on a contact button counts too, and a plain hover does not', () => {
    const { container } = render(<ClassDetail w={cls} ended={false} now={new Date('2099-01-01T00:00:00Z')} />);
    const primary = container.querySelector('.cd-cta a.primary')!;
    fireEvent.mouseOver(primary);
    expect(events).toHaveLength(0);
    fireEvent(primary, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(names()).toEqual(['contact_seller', 'contact_whatsapp']);
    events.length = 0;
    fireEvent(primary, new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(events).toHaveLength(0);
  });
  it('the in-person page reports its host icons, and its Reserve button reports reserve_open', () => {
    const { container } = render(<StoreProvider><CraftDetail w={{ ...event, whatsapp: '+919989898999' } as Workshop} ended={false} /></StoreProvider>);
    fireEvent.click(container.querySelector('.cd-icons a')!);
    expect(names()[0]).toBe('contact_seller');
    expect(last('contact_seller')).toMatchObject({ workshop_id: 'w9', content_type: 'workshop', placement: 'page' });
    events.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /reserve spot/i }));
    expect(names()).toEqual(['reserve_open']);
    expect(last('reserve_open')).toEqual({ workshop_id: 'w9', price_type: 'paid' });
  });
});

describe('the cards', () => {
  it('opening a card reports select_item, and its contact buttons report the contact with placement card', () => {
    const { container } = render(<StoreProvider><WorkshopCard w={cls} /></StoreProvider>);
    fireEvent.click(container.querySelector('h3 a')!);
    expect(names()).toEqual(['select_item']);
    expect(last('select_item')).toMatchObject({ item_id: 'w4', item_list_id: 'workshops', content_type: 'class', item_category: 'Yoga' });
    events.length = 0;
    fireEvent.click(screen.getByRole('link', { name: 'WhatsApp' }));
    expect(last('contact_whatsapp')).toMatchObject({ workshop_id: 'w4', placement: 'card' });
    fireEvent.click(screen.getByRole('link', { name: 'Website' }));
    expect(last('contact_website')).toMatchObject({ workshop_id: 'w4', placement: 'card', contact_method: 'website' });
  });
  it('WorkshopContact reports Call, WhatsApp, Instagram and Website, each once per click', () => {
    render(<WorkshopContact w={cls} workshopId="w4" contentType="class" placement="card" />);
    for (const label of [/^Call/, 'WhatsApp', /Instagram/, 'Website']) fireEvent.click(screen.getByRole('link', { name: label }));
    expect(names().filter(n => n === 'contact_seller')).toHaveLength(4);
    expect(names().filter(n => n.startsWith('contact_') && n !== 'contact_seller')).toEqual(['contact_call', 'contact_whatsapp', 'contact_instagram', 'contact_website']);
  });
  it('no event carries a phone number, an email or a link', () => {
    render(<WorkshopContact w={cls} workshopId="w4" contentType="class" placement="card" />);
    for (const label of [/^Call/, 'WhatsApp', /Instagram/, 'Website']) fireEvent.click(screen.getByRole('link', { name: label }));
    expect(JSON.stringify(events)).not.toMatch(/9989898999|@|https?:|anaya/);
  });
});

describe('booking', () => {
  function Reserver({ w }: { w: Workshop }) {
    const { reserve } = useStore();
    return <button onClick={() => void reserve({ workshopId: w.id, attendeeName: 'A', email: 'a@x.co', quantity: 2 })}>go</button>;
  }
  it('reserve_complete says how many seats and whether it was free; reserve_error when it is refused', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'CONFIRMED_FREE_DEMO', title: 'Lac Craft' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Not enough seats remaining.' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<StoreProvider><Reserver w={event} /></StoreProvider>);
    await act(async () => { fireEvent.click(screen.getByText('go')); });
    expect(last('reserve_complete')).toEqual({ workshop_id: 'w9', seats: 2, price_type: 'free' });
    events.length = 0;
    await act(async () => { fireEvent.click(screen.getByText('go')); });
    expect(names()).toEqual(['reserve_error']);
    expect(last('reserve_error')).toEqual({ workshop_id: 'w9', seats: 2 });
  });
  it('the Reserve spot button reports reserve_open, and a full workshop (disabled) does not', () => {
    render(<StoreProvider><ReserveButton workshop={event} /></StoreProvider>);
    fireEvent.click(screen.getByRole('button', { name: /reserve spot/i }));
    expect(names()).toEqual(['reserve_open']);
    cleanup(); events.length = 0;
    render(<StoreProvider><ReserveButton workshop={{ ...event, booked: 8 } as Workshop} /></StoreProvider>);
    fireEvent.click(screen.getByRole('button', { name: /full/i }));
    expect(events).toHaveLength(0);
  });
});

describe('the workshop list', () => {
  const CITIES = [{ name: 'Jaipur', slug: 'jaipur' }, { name: 'Jodhpur', slug: 'jodhpur' }];
  const renderList = (initial: Record<string, string> = {}) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } } });
    return render(<QueryClientProvider client={client}><StoreProvider><LiveCatalog kind="workshops" cities={CITIES} initialItems={[cls, event]} initialValues={initial} /></StoreProvider></QueryClientProvider>);
  };
  it('reports view_item_list when it first shows, with the count and no filters', () => {
    renderList();
    expect(names()).toEqual(['view_item_list']);
    expect(last('view_item_list')).toEqual({ item_list_id: 'workshops', item_list_name: 'workshops', item_count: 2 });
  });
  it('reports the filters it opens with (a shared link), and a search term as a search', () => {
    renderList({ city: 'jaipur', type: 'FREE', mode: 'online', q: 'yoga' });
    expect(names()).toEqual(['view_item_list', 'search']);
    expect(last('view_item_list')).toMatchObject({ city: 'jaipur', price_type: 'FREE', format: 'online', item_count: 2 });
  });
  it('a changed filter reports the new list and filter_change, once its results are in; typing waits for the pause', async () => {
    vi.useFakeTimers();
    notifyManager.setScheduler(cb => cb());
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [event] });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/workshops');
    renderList();
    events.length = 0;
    await act(async () => { fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: 'jaipur' } }); await vi.advanceTimersByTimeAsync(10); });
    expect(names()).toEqual(['view_item_list', 'filter_change']);
    expect(last('view_item_list')).toMatchObject({ city: 'jaipur', item_count: 1 });
    events.length = 0;
    await act(async () => { fireEvent.change(screen.getByLabelText('Search workshops'), { target: { value: 'lac' } }); await vi.advanceTimersByTimeAsync(100); });
    expect(events).toHaveLength(0); // still inside the typing pause
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(names()).toEqual(['view_item_list', 'search']);
    expect(last('search')).toEqual({ search_term: 'lac', item_list_id: 'workshops' });
  });
});

describe('the host form', () => {
  const val = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
  const next = () => fireEvent.click(screen.getByRole('button', { name: /^next/i }));
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); window.history.replaceState(null, '', '/workshops'); });

  it('reports host_form_open when the form is opened, with the path', () => {
    render(<HostWorkshopButton path="class" topics={[{ id: 1, name: 'Yoga' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(names()).toEqual(['host_form_open']);
    expect(last('host_form_open')).toEqual({ form_path: 'class' });
  });
  it('reports each step reached (2, then 3) and the submit once the server accepted it, and nothing from what was typed', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'asha@example.com', status: 'pending' }) });
    render(<HostWorkshopButton path="class" topics={[{ id: 1, name: 'Yoga' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    val(/event title|class title/i, 'Morning Flow'); val(/what happens|about the class/i, 'Gentle hatha yoga.');
    next();
    expect(events.filter(e => e.name === 'host_form_step').map(e => e.params)).toEqual([{ form_path: 'class', step_number: 2 }]);
    val(/online platform/i, 'Zoom'); val(/start date/i, '2027-01-05');
    fireEvent.click(screen.getByLabelText('Mon')); fireEvent.click(screen.getByLabelText('Wed')); val(/class time/i, '07:00');
    next();
    expect(events.filter(e => e.name === 'host_form_step').map(e => e.params)).toEqual([{ form_path: 'class', step_number: 2 }, { form_path: 'class', step_number: 3 }]);
    expect(names()).not.toContain('host_form_submit');
    val(/host, studio/i, 'Asha Yoga'); val(/your name/i, 'Asha Rao'); val(/phone number/i, '9989898999'); val(/^email/i, 'asha@example.com');
    fireEvent.click(screen.getByRole('combobox', { name: /languages/i })); fireEvent.click(screen.getByRole('option', { name: 'Hindi' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /send details/i })); });
    expect(names().filter(n => n === 'host_form_submit')).toHaveLength(1);
    expect(last('host_form_submit')).toEqual({ form_path: 'class' });
    expect(JSON.stringify(events)).not.toMatch(/asha|9989898999|Morning Flow/i);
  });
  it('a refused submit reports no host_form_submit', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'title must be text.' }) });
    render(<HostWorkshopButton path="class" topics={[{ id: 1, name: 'Yoga' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    val(/event title|class title/i, 'Morning Flow'); val(/what happens|about the class/i, 'Gentle hatha yoga.'); next();
    val(/online platform/i, 'Zoom'); val(/start date/i, '2027-01-05');
    fireEvent.click(screen.getByLabelText('Mon')); val(/class time/i, '07:00'); next();
    val(/host, studio/i, 'Asha Yoga'); val(/your name/i, 'Asha Rao'); val(/phone number/i, '9989898999'); val(/^email/i, 'asha@example.com');
    fireEvent.click(screen.getByRole('combobox', { name: /languages/i })); fireEvent.click(screen.getByRole('option', { name: 'Hindi' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /send details/i })); });
    expect(names()).not.toContain('host_form_submit');
  });
});
