// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input aria-label="City" name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));
vi.mock('@/components/RequestReceived', () => ({ RequestReceived: () => <p>received</p> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/dashboard/posts', useSearchParams: () => new URLSearchParams() }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { SellerWorkshops } from '@/components/SellerWorkshops';
import { WorkshopContact } from '@/components/WorkshopContact';
import type { Workshop } from '@/lib/types';

const fetchMock = vi.fn();
const val = (l: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^next/i }));
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); window.history.replaceState(null, '', '/workshops'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function toStep3() {
  render(<HostWorkshopButton path="class" topics={[]} />);
  fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
  val(/class title/i, 'Morning Flow'); val(/about the class/i, 'Gentle yoga.'); next();
  val(/online platform/i, 'Zoom'); val(/start date/i, '2027-01-05'); fireEvent.click(screen.getByLabelText('Mon')); val(/class time/i, '07:00'); next();
  val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co');
}
const sentBody = () => JSON.parse(String(fetchMock.mock.calls[0][1].body));

describe('host form: show this number to the audience', () => {
  it('the phone stays required, and the choice is a checkbox that is off by default', () => {
    toStep3();
    expect((screen.getByLabelText(/phone number/i) as HTMLInputElement).required).toBe(true);
    const box = screen.getByLabelText(/show this number to the audience/i) as HTMLInputElement;
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(false);
  });
  it('sends phonePublic false unless ticked, true when ticked', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    toStep3(); val(/whatsapp/i, '9989898999');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().phonePublic).toBe(false);
    cleanup(); fetchMock.mockClear();
    toStep3(); fireEvent.click(screen.getByLabelText(/show this number to the audience/i));
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().phonePublic).toBe(true);
  });
});

describe('the Call button on a listing', () => {
  it('shows Call with the number only when the host chose to show it', () => {
    const { container, rerender } = render(<WorkshopContact w={{ whatsapp: null, instagram: null, website: null, publicPhone: '+919989898999' }} workshopId="w1" contentType="class" placement="card" />);
    expect(screen.getByRole('link', { name: /call \+919989898999/i }).getAttribute('href')).toBe('tel:+919989898999');
    rerender(<WorkshopContact w={{ whatsapp: null, instagram: null, website: null }} workshopId="w1" contentType="class" placement="card" />);
    expect(container.textContent).toBe('');
  });
});

describe('seller edit form keeps the choice', () => {
  const w = { id: 'w1', title: 'Morning Flow', kind: 'class', mode: 'online', topicId: null, endsOn: '2099-03-30', platform: 'Zoom', schedule: { repeat: 'weekly', days: ['mon'], time: '07:00', durationMin: 60 }, languages: [], level: null, experience: null, certifications: null, freeTrial: false, freeTrialDays: null, whatsapp: null, instagram: null, website: null, images: [], prices: [], booked: 0, status: 'DRAFT', type: 'FREE', pricePaise: 0, city: null, cityId: null, citySlug: null, venue: null, seats: null, date: '2099-01-05', time: '07:00', host: 'Swati', description: 'd', hostId: 'u1', contactPhone: '+919989898999', phonePublic: true } as unknown as Workshop;
  it('shows the box ticked when it was on, and sends the new value on save', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => w });
    render(<SellerWorkshops initial={[w]} topics={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Morning Flow' }));
    const dlg = await screen.findByRole('dialog', { name: /edit workshop/i });
    const box = within(dlg).getByLabelText(/show this number to the audience/i) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(within(dlg).getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshops/w1', expect.objectContaining({ method: 'PATCH' })));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).phonePublic).toBe(false);
  });
});
