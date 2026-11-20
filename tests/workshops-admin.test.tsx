// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: ({ required }: { required?: boolean }) => <input aria-label="City" name="cityRef" required={required} /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <input type="hidden" name="images" value="https://img.test/a.jpg" /> }));

import { WorkshopsAdmin } from '@/components/WorkshopsAdmin';
import type { Workshop } from '@/lib/types';
import type { WorkshopRequest } from '@/lib/workshop-requests';

const fetchMock = vi.fn();
const topics = [{ id: 1, name: 'Yoga' }];
const base = {
  kind: 'workshop', mode: 'in_person', topicId: null, endsOn: null, platform: null, schedule: null, languages: [], level: null, experience: null, certifications: null, freeTrial: false, freeTrialDays: null,
  whatsapp: null, instagram: null, website: null, images: [], prices: [], booked: 0, status: 'DRAFT',
};
const lac = { ...base, id: 'w1', title: 'Lac Craft', type: 'PAID', pricePaise: 30000, city: 'Jodhpur', cityId: 3, citySlug: 'jodhpur', venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.' } as unknown as Workshop;
const yoga = { ...base, id: 'w2', title: 'Morning Flow', kind: 'class', mode: 'online', topicId: 1, topic: { id: 1, name: 'Yoga', slug: 'yoga' }, type: 'PAID', pricePaise: 50000, city: null, cityId: null, citySlug: null, venue: null, seats: null, date: '2099-01-05', time: '07:00',
  platform: 'Zoom', schedule: { days: ['mon', 'wed'], time: '07:00', durationMin: 60 }, host: 'Asha Rao', description: 'Gentle yoga.', status: 'APPROVED', languages: ['Hindi'], level: 'beginner', contactPhone: '+919989898999',
  prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }] } as unknown as Workshop;
const req = { id: 'r1', hostName: 'Asha Yoga', contactName: 'Asha', phone: '+919989898999', email: 'asha@example.com', city: '', venue: '', title: 'Evening Flow', kind: 'class', mode: 'online', topicId: 1, description: 'Calm yoga.',
  startDate: '2099-02-02', endDate: '2099-02-02', status: 'received', emailVerified: true, images: [], priceType: 'PAID', pricePaise: 50000, createdAt: '', platform: 'Google Meet', schedule: { days: ['tue'], time: '18:30', durationMin: 45 },
  languages: ['English'], level: 'all', freeTrial: true, freeTrialDays: 7, whatsapp: '+919989898999', prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }] } as unknown as WorkshopRequest;
const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('listings table', () => {
  it('shows title, host, format with topic, when, and a status select with the stored status', () => {
    render(<WorkshopsAdmin initial={[lac, yoga]} topics={topics} />);
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Lac Craft')).toBeTruthy();
    expect(within(rows[1]).getByText(/In person/)).toBeTruthy();
    expect((within(rows[1]).getByLabelText('Status of Lac Craft') as HTMLSelectElement).value).toBe('DRAFT');
    expect(within(rows[2]).getByText(/Online · Yoga/)).toBeTruthy();
    expect(within(rows[2]).getByText(/Mon, Wed at 7:00 am, 60 min/)).toBeTruthy();
    expect((within(rows[2]).getByLabelText('Status of Morning Flow') as HTMLSelectElement).value).toBe('APPROVED');
  });
  it('changing the status calls the status route and shows the new value', async () => {
    fetchMock.mockResolvedValue(ok({ ...lac, status: 'APPROVED' }));
    render(<WorkshopsAdmin initial={[lac]} topics={topics} />);
    fireEvent.change(screen.getByLabelText('Status of Lac Craft'), { target: { value: 'APPROVED' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshops/w1/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) })));
    await waitFor(() => expect((screen.getByLabelText('Status of Lac Craft') as HTMLSelectElement).value).toBe('APPROVED'));
  });
  it('a failed status change keeps the old value and says so', async () => {
    fetchMock.mockResolvedValue(ok({ error: 'Nope' }, 400));
    render(<WorkshopsAdmin initial={[lac]} topics={topics} />);
    fireEvent.change(screen.getByLabelText('Status of Lac Craft'), { target: { value: 'APPROVED' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Nope/));
    expect((screen.getByLabelText('Status of Lac Craft') as HTMLSelectElement).value).toBe('DRAFT');
  });
});

describe('start and created dates', () => {
  it('shows when the workshop starts and when the listing was created, in India time', () => {
    const w = { ...lac, createdAt: '2026-11-18T14:05:00.000Z' } as unknown as Workshop; // 19:35 in India
    render(<WorkshopsAdmin initial={[w]} topics={topics} />);
    expect(screen.getByRole('columnheader', { name: 'Starts' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Created' })).toBeTruthy();
    const row = screen.getByText('Lac Craft').closest('tr') as HTMLElement;
    expect(row.textContent).toContain('1 Dec 2099, 16:30');
    expect(row.textContent).toContain('18 Nov 2026, 7:35 pm');
  });
  it('a class shows its start date, and a listing with no created time shows a dash', () => {
    render(<WorkshopsAdmin initial={[yoga]} topics={topics} />);
    const row = screen.getByText('Morning Flow').closest('tr') as HTMLElement;
    expect(row.textContent).toContain('5 Jan 2099, 07:00');
    expect(row.querySelectorAll('td')[5].textContent).toBe('—');
  });
});

describe('tags column', () => {
  const tags = (row: HTMLElement) => Array.from(row.querySelectorAll('.badge')).map(b => [b.textContent, b.className]);
  const rowOf = (title: string) => screen.getByText(title).closest('tr') as HTMLElement;
  const ended = { ...lac, id: 'w5', title: 'Old Clay', status: 'APPROVED', date: '2020-01-01' } as unknown as Workshop;
  const weeklyDraft = { ...yoga, id: 'w6', title: 'Weekly Draft', status: 'DRAFT' } as unknown as Workshop;
  const monthly = { ...yoga, id: 'w7', title: 'Monthly Flow', schedule: { repeat: 'monthly', days: ['sat'], weeks: [1], time: '07:00', durationMin: 60 } } as unknown as Workshop;
  it('has a Tags column', () => {
    render(<WorkshopsAdmin initial={[lac]} topics={topics} />);
    expect(screen.getByRole('columnheader', { name: 'Tags' })).toBeTruthy();
  });
  it('a draft shows a grey In Draft tag', () => {
    render(<WorkshopsAdmin initial={[lac]} topics={topics} />);
    expect(tags(rowOf('Lac Craft'))).toEqual([['In Draft', 'badge archived']]);
  });
  it('a repeating class shows a yellow Recurring tag, weekly or monthly; a published one-off shows none', () => {
    render(<WorkshopsAdmin initial={[yoga, monthly, { ...lac, id: 'w8', title: 'One Off', status: 'APPROVED' } as unknown as Workshop]} topics={topics} />);
    expect(tags(rowOf('Morning Flow'))).toEqual([['Recurring', 'badge recurring']]);
    expect(tags(rowOf('Monthly Flow'))).toEqual([['Recurring', 'badge recurring']]);
    expect(tags(rowOf('One Off'))).toEqual([]);
  });
  it('a listing that has ended shows a green Ended tag', () => {
    render(<WorkshopsAdmin initial={[ended]} topics={topics} />);
    expect(tags(rowOf('Old Clay'))).toEqual([['Ended', 'badge published']]);
  });
  it('tags add up: a recurring draft is Recurring and In Draft', () => {
    render(<WorkshopsAdmin initial={[weeklyDraft]} topics={topics} />);
    expect(tags(rowOf('Weekly Draft')).map(t => t[0])).toEqual(['Recurring', 'In Draft']);
  });
  it('an ended recurring class (it has an end date in the past) is Recurring and Ended', () => {
    render(<WorkshopsAdmin initial={[{ ...yoga, id: 'w9', title: 'Past Series', endsOn: '2020-06-01', date: '2020-01-01' } as unknown as Workshop]} topics={topics} />);
    expect(tags(rowOf('Past Series')).map(t => t[0])).toEqual(['Recurring', 'Ended']);
  });
});

describe('listing form', () => {
  it('New listing opens a form that defaults to Draft and has no email code or honeypot', () => {
    render(<WorkshopsAdmin initial={[]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /new listing/i }));
    const dlg = screen.getByRole('dialog');
    expect((within(dlg).getByLabelText('Status') as HTMLSelectElement).value).toBe('DRAFT');
    expect(Array.from((within(dlg).getByLabelText('Status') as HTMLSelectElement).options).map(o => o.textContent)).toEqual(['Draft', 'Published', 'Archived']);
    expect(dlg.querySelector('[name="companyWebsite"]')).toBeNull();
    expect(within(dlg).queryByText(/code/i)).toBeNull();
  });
  it('creates an online class as a Draft with the private contact, and adds it to the table', async () => {
    fetchMock.mockResolvedValue(ok({ ...yoga, status: 'DRAFT', id: 'w9' }, 201));
    render(<WorkshopsAdmin initial={[]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /new listing/i }));
    const dlg = screen.getByRole('dialog');
    fireEvent.click(within(dlg).getByLabelText('Online class'));
    const set = (l: RegExp | string, v: string) => fireEvent.change(within(dlg).getByLabelText(l), { target: { value: v } });
    set(/class title/i, 'Morning Flow'); set(/about the class/i, 'Gentle yoga.'); set(/online platform/i, 'Zoom'); set(/start date/i, '2099-01-05');
    fireEvent.click(within(dlg).getByLabelText('Mon')); set(/class time/i, '07:00');
    set(/host, studio/i, 'Asha Rao'); set(/contact name/i, 'Asha'); set(/contact phone/i, '9989898999'); set(/contact email/i, 'asha@example.com');
    fireEvent.click(within(dlg).getByRole('button', { name: /save listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/workshops');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({
      status: 'DRAFT', mode: 'online', kind: 'class', title: 'Morning Flow', host: 'Asha Rao', platform: 'Zoom', date: '2099-01-05', time: '07:00',
      schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, contactName: 'Asha', contactPhone: '9989898999', contactEmail: 'asha@example.com',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Morning Flow')).toBeTruthy();
  });
  it('Delete asks for confirmation, then removes the listing', async () => {
    fetchMock.mockResolvedValue(ok({ ok: true, unlinkedProducts: 0 }));
    render(<WorkshopsAdmin initial={[lac]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lac Craft' }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshops/w1', expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.queryByText('Lac Craft')).toBeNull());
  });
  it('Keep cancels a delete', () => {
    render(<WorkshopsAdmin initial={[lac]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lac Craft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.getByRole('button', { name: 'Delete Lac Craft' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('a class saved with no end date ends on its start date, and the note says so', async () => {
    fetchMock.mockResolvedValue(ok({ ...yoga, id: 'w11' }, 201));
    render(<WorkshopsAdmin initial={[]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /new listing/i }));
    const dlg = screen.getByRole('dialog');
    fireEvent.click(within(dlg).getByLabelText('Online class'));
    const set = (l: RegExp | string, v: string) => fireEvent.change(within(dlg).getByLabelText(l), { target: { value: v } });
    set(/class title/i, 'Flow'); set(/about the class/i, 'd'); set(/online platform/i, 'Zoom'); set(/start date/i, '2099-01-05');
    fireEvent.click(within(dlg).getByLabelText('Mon')); set(/class time/i, '07:00'); set(/host, studio/i, 'H');
    expect(within(dlg).getByText(/the classes end on 5 Jan 2099, the start date/i)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: /save listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).endsOn).toBe('2099-01-05');
  });
  it('a bad meeting link and a server message about the contact email show under their own fields', async () => {
    fetchMock.mockResolvedValue(ok({ error: 'contactEmail must be a valid email address.' }, 400));
    render(<WorkshopsAdmin initial={[]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /new listing/i }));
    const dlg = screen.getByRole('dialog');
    fireEvent.click(within(dlg).getByLabelText('Online class'));
    const set = (l: RegExp | string, v: string) => fireEvent.change(within(dlg).getByLabelText(l), { target: { value: v } });
    set(/class title/i, 'Flow'); set(/about the class/i, 'd'); set(/online platform/i, 'Zoom'); set(/start date/i, '2099-01-05');
    fireEvent.click(within(dlg).getByLabelText('Mon')); set(/class time/i, '07:00'); set(/host, studio/i, 'H');
    set(/meeting link/i, 'https://zoom');
    fireEvent.click(within(dlg).getByRole('button', { name: /save listing/i }));
    expect(within(dlg).getByLabelText(/meeting link/i).closest('label')?.querySelector('[role="alert"]')?.textContent).toMatch(/not a valid meeting link/i);
    expect(fetchMock).not.toHaveBeenCalled();
    set(/meeting link/i, 'https://zoom.us/j/1'); set(/contact email/i, 'a@b.co');
    fireEvent.click(within(dlg).getByRole('button', { name: /save listing/i }));
    await waitFor(() => expect(within(dlg).getByLabelText(/contact email/i).closest('label')?.querySelector('[role="alert"]')?.textContent).toMatch(/^Contact email must be a valid email/));
    expect(dlg.querySelector('.admin-error')).toBeNull();
  });
  it('Edit opens the form filled with the listing and saves with PATCH', async () => {
    fetchMock.mockResolvedValue(ok({ ...yoga, title: 'Morning Flow 2' }));
    render(<WorkshopsAdmin initial={[yoga]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Morning Flow' }));
    const dlg = screen.getByRole('dialog');
    expect((within(dlg).getByLabelText(/class title/i) as HTMLInputElement).value).toBe('Morning Flow');
    expect((within(dlg).getByLabelText(/online platform/i) as HTMLInputElement).value).toBe('Zoom');
    expect((within(dlg).getByLabelText('Mon') as HTMLInputElement).checked).toBe(true);
    expect((within(dlg).getByLabelText('Tue') as HTMLInputElement).checked).toBe(false);
    expect((within(dlg).getByLabelText('Plan 1 name') as HTMLInputElement).value).toBe('Monthly');
    expect(within(dlg).getByRole('button', { name: /remove hindi/i })).toBeTruthy(); // the languages show as chips
    expect((within(dlg).getByLabelText('Status') as HTMLSelectElement).value).toBe('APPROVED');
    expect((within(dlg).getByLabelText(/contact phone/i) as HTMLInputElement).value).toBe('+919989898999');
    fireEvent.change(within(dlg).getByLabelText(/class title/i), { target: { value: 'Morning Flow 2' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /save listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/workshops/w2');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sourceRequestId).toBeUndefined();
    await waitFor(() => expect(screen.getByText('Morning Flow 2')).toBeTruthy());
  });
  it('from a request with Published chosen on the request: the form opens with Published preselected', () => {
    render(<WorkshopsAdmin initial={[]} topics={topics} fromRequest={req} presetStatus="APPROVED" />);
    expect((within(screen.getByRole('dialog')).getByLabelText('Status') as HTMLSelectElement).value).toBe('APPROVED');
  });
  it('from a request: opens prefilled as Draft and posts the sourceRequestId', async () => {
    fetchMock.mockResolvedValue(ok({ ...yoga, id: 'w10', status: 'DRAFT', title: 'Evening Flow' }, 201));
    render(<WorkshopsAdmin initial={[]} topics={topics} fromRequest={req} />);
    const dlg = screen.getByRole('dialog');
    expect((within(dlg).getByLabelText(/class title/i) as HTMLInputElement).value).toBe('Evening Flow');
    expect((within(dlg).getByLabelText(/online platform/i) as HTMLInputElement).value).toBe('Google Meet');
    expect((within(dlg).getByLabelText('Status') as HTMLSelectElement).value).toBe('DRAFT');
    expect((within(dlg).getByLabelText(/host, studio/i) as HTMLInputElement).value).toBe('Asha Yoga');
    expect((within(dlg).getByLabelText(/contact email/i) as HTMLInputElement).value).toBe('asha@example.com');
    fireEvent.click(within(dlg).getByRole('button', { name: /save listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ sourceRequestId: 'r1', status: 'DRAFT', title: 'Evening Flow', prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }], freeTrial: true, freeTrialDays: 7 });
  });

  it('an event body clears the class fields and price rows; a class body clears city and venue', async () => {
    fetchMock.mockResolvedValue(ok({ ...lac }));
    render(<WorkshopsAdmin initial={[lac]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lac Craft' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ prices: [], schedule: null, platform: null, seats: 8 });
    cleanup(); fetchMock.mockReset(); fetchMock.mockResolvedValue(ok({ ...yoga }));
    render(<WorkshopsAdmin initial={[yoga]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Morning Flow' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /save listing/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ venue: null, cityId: null, seats: null });
  });
  it('an in-person listing with the seats left blank is refused, not saved with 1000 seats', async () => {
    render(<WorkshopsAdmin initial={[]} topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /new listing/i }));
    const dlg = screen.getByRole('dialog');
    const set = (l: RegExp | string, v: string) => fireEvent.change(within(dlg).getByLabelText(l), { target: { value: v } });
    set(/event title/i, 'Clay'); set(/what happens/i, 'Clay day'); set(/start date/i, '2099-01-05'); set(/^city/i, 'x'); set(/venue/i, 'Studio'); set(/host, studio/i, 'H');
    fireEvent.click(within(dlg).getByRole('button', { name: /save listing/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(dlg).getByRole('alert').textContent).toMatch(/seats/i);
  });
});
