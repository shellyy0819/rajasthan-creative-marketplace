// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input aria-label="City" name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));
vi.mock('@/components/RequestReceived', () => ({ RequestReceived: () => <p>received</p> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { SellerWorkshops } from '@/components/SellerWorkshops';
import type { Workshop } from '@/lib/types';

const fetchMock = vi.fn();
const val = (l: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^next/i }));
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); window.history.replaceState(null, '', '/workshops'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('craft questions on the in-person host form', () => {
  it('are optional, on the last step, and sent as lists', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    render(<HostWorkshopButton topics={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    val(/event title/i, 'Block printing'); val(/^type/i, 'workshop'); val(/what happens/i, 'Print on cotton.'); next();
    val(/start date/i, '2099-02-05'); val(/^city/i, 'x'); val(/venue/i, 'Rang Studio'); next();
    expect((screen.getByLabelText(/^minimum age/i) as HTMLInputElement).required).toBe(false);
    val(/^minimum age/i, '14'); val('Item 1 title', 'A cotton tote bag'); val('Item 1 short line', 'Printed with a border.');
    val(/what is included/i, 'Blocks and dyes\nMasala chai'); val(/what to bring/i, 'Old clothes');
    val(/host, studio/i, 'Rang Studio'); val(/your name/i, 'Ravi'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ minAge: 14, included: ['Blocks and dyes', 'Masala chai'], bring: ['Old clothes'], makes: [{ title: 'A cotton tote bag', text: 'Printed with a border.' }] });
  });
  it('are not asked on the online class path (it has its own questions)', () => {
    render(<HostWorkshopButton path="class" topics={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(screen.queryByLabelText(/what is included/i)).toBeNull();
  });
});

describe('craft questions when a seller edits their workshop', () => {
  const w = { id: 'w9', title: 'Block printing', kind: 'workshop', mode: 'in_person', topicId: null, endsOn: null, platform: null, schedule: null, languages: [], level: null, experience: null, certifications: null, freeTrial: false, freeTrialDays: null, whatsapp: '9989898999', instagram: null, website: null, images: [], prices: [], booked: 0, status: 'APPROVED', type: 'PAID', pricePaise: 120000, city: 'Jaipur', cityId: 1, citySlug: 'jaipur', venue: 'Rang Studio', seats: 12, date: '2099-02-05', time: '16:00', host: 'Rang Studio', description: 'd', hostId: 'u1',
    makes: [{ title: 'A cotton tote bag', text: 'Printed.' }], included: ['Blocks and dyes'], bring: ['Old clothes'], minAge: 14 } as unknown as Workshop;
  it('show what is stored, and save changes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => w });
    render(<SellerWorkshops initial={[w]} topics={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Block printing' }));
    const dlg = await screen.findByRole('dialog', { name: /edit workshop/i });
    expect((within(dlg).getByLabelText('Item 1 title') as HTMLInputElement).value).toBe('A cotton tote bag');
    expect((within(dlg).getByLabelText(/what is included/i) as HTMLTextAreaElement).value).toBe('Blocks and dyes');
    expect((within(dlg).getByLabelText(/^minimum age/i) as HTMLInputElement).value).toBe('14');
    fireEvent.change(within(dlg).getByLabelText(/what to bring/i), { target: { value: '' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshops/w9', expect.objectContaining({ method: 'PATCH' })));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ bring: [], included: ['Blocks and dyes'], minAge: 14 });
  });
});
