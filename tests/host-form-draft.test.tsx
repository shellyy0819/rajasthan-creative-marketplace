// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input aria-label="City" name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: ({ initial }: { initial: string[] }) => <div>{initial.map(u => <input key={u} type="hidden" name="images" value={u} />)}</div> }));
vi.mock('@/components/RequestReceived', () => ({ RequestReceived: () => <p>received</p> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { DRAFT_KEY } from '@/lib/host-draft';

const fetchMock = vi.fn();
const val = (l: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^next/i }));
const openForm = (props: object = {}) => { render(<HostWorkshopButton saveDraft topics={[{ id: 1, name: 'Yoga' }]} {...props} />); fireEvent.click(screen.getByRole('button', { name: /host a workshop/i })); };
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 600)); });
const stored = () => JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');

beforeEach(() => { localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('saving the host form as a draft', () => {
  it('closing and reopening brings back what was typed and the step', async () => {
    openForm();
    val(/event title/i, 'Clay day'); val(/^type/i, 'workshop'); val(/what happens/i, 'We make bowls.'); next();
    val(/start date/i, '2099-01-05'); val(/venue/i, 'Studio 9');
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    await waitFor(() => expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2099-01-05'));
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect((screen.getByLabelText(/venue/i) as HTMLInputElement).value).toBe('Studio 9');
    expect(screen.getByText(/restored your saved draft/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^back/i }));
    expect((screen.getByLabelText(/event title/i) as HTMLInputElement).value).toBe('Clay day');
    expect((screen.getByLabelText(/^type/i) as HTMLSelectElement).value).toBe('workshop');
  });
  it('survives a page refresh (a fresh mount)', async () => {
    openForm();
    val(/event title/i, 'Refresh me');
    await flush();
    cleanup();
    openForm();
    await waitFor(() => expect((screen.getByLabelText(/event title/i) as HTMLInputElement).value).toBe('Refresh me'));
  });
  it('restores the online class path with its days, weeks, repeat and price plans', async () => {
    openForm({ path: 'class' });
    val(/class title/i, 'Flow'); val(/about the class/i, 'Calm'); next();
    fireEvent.change(screen.getByLabelText('Repeats'), { target: { value: 'monthly' } });
    fireEvent.click(screen.getByLabelText('Sat')); fireEvent.click(screen.getByLabelText('1st')); fireEvent.click(screen.getByLabelText('3rd'));
    fireEvent.click(screen.getByRole('button', { name: /add a price plan/i }));
    fireEvent.change(screen.getByLabelText('Plan 1 name'), { target: { value: 'Monthly' } });
    fireEvent.change(screen.getByLabelText('Plan 1 price (Rs.)'), { target: { value: '1500' } });
    await flush();
    cleanup();
    openForm({ path: 'class' });
    await waitFor(() => expect((screen.getByLabelText('Repeats') as HTMLSelectElement).value).toBe('monthly'));
    expect((screen.getByLabelText('Sat') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Mon') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('1st') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('2nd') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Plan 1 name') as HTMLInputElement).value).toBe('Monthly');
    expect((screen.getByLabelText('Plan 1 price (Rs.)') as HTMLInputElement).value).toBe('1500');
  });
  it('does not restore a draft from the other path', async () => {
    openForm();
    val(/event title/i, 'In person thing');
    await flush();
    cleanup();
    openForm({ path: 'class' });
    expect((screen.getByLabelText(/class title/i) as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/restored your saved draft/i)).toBeNull();
  });
  it('never stores the spam trap or the email code, and only keeps a draft for a week', async () => {
    openForm();
    val(/event title/i, 'T');
    await flush();
    expect(Object.keys(stored().fields)).not.toContain('companyWebsite');
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...stored(), savedAt: Date.now() - 8 * 86_400_000 }));
    cleanup();
    openForm();
    expect((screen.getByLabelText(/event title/i) as HTMLInputElement).value).toBe('');
    localStorage.setItem(DRAFT_KEY, '{not json');
    cleanup();
    openForm();
    expect((screen.getByLabelText(/event title/i) as HTMLInputElement).value).toBe('');
  });
  it('Start over clears the draft and the form', async () => {
    openForm();
    val(/event title/i, 'Old'); await flush();
    cleanup(); openForm();
    await waitFor(() => screen.getByText(/restored your saved draft/i));
    fireEvent.click(screen.getByRole('button', { name: /start over/i }));
    expect((screen.getByLabelText(/event title/i) as HTMLInputElement).value).toBe('');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.queryByText(/restored your saved draft/i)).toBeNull();
  });
  it('a successful send clears the draft', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    openForm();
    val(/event title/i, 'T'); val(/^type/i, 'workshop'); val(/what happens/i, 'd'); next();
    val(/start date/i, '2099-01-05'); val(/^city/i, 'x'); val(/venue/i, 'v'); next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co');
    await flush();
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
  });
  it('never saves who the person is: name, email, phone, WhatsApp or host name stay out of the draft', async () => {
    openForm();
    val(/event title/i, 'T'); val(/^type/i, 'workshop'); val(/what happens/i, 'd'); next();
    val(/start date/i, '2099-01-05'); val(/^city/i, 'x'); val(/venue/i, 'v'); next();
    val(/host, studio/i, 'Asha Yoga'); val(/your name/i, 'Asha Rao'); val(/phone number/i, '9989898999'); val(/^email/i, 'asha@example.com'); val(/^instagram/i, '@asha');
    await flush();
    const raw = localStorage.getItem(DRAFT_KEY) ?? '';
    for (const secret of ['Asha Yoga', 'Asha Rao', '9989898999', 'asha@example.com']) expect(raw, secret).not.toContain(secret);
    expect(stored().fields.venue).toBe('v');
    cleanup(); openForm();
    await waitFor(() => screen.getByText('Step 3 of 3'));
    expect((screen.getByLabelText(/your name/i) as HTMLInputElement).value).toBe('');
  });
  it('does nothing unless the page turned drafts on', async () => {
    render(<HostWorkshopButton />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    val(/event title/i, 'T'); await flush();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
