// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input aria-label="City" name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: ({ initial }: { initial: string[] }) => <div>{initial.map(u => <input key={u} type="hidden" name="images" value={u} />)}</div> }));
vi.mock('@/components/RequestReceived', () => ({ RequestReceived: () => <p>received</p> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { HostDraftReminder } from '@/components/HostDraftReminder';
import { DRAFT_KEY, timeAgo } from '@/lib/host-draft';

const fetchMock = vi.fn();
const val = (l: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^next/i }));
const openForm = (props: object = {}) => { render(<HostWorkshopButton saveDraft topics={[{ id: 1, name: 'Yoga' }]} {...props} />); fireEvent.click(screen.getByRole('button', { name: /host a workshop|continue your listing/i })); };
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
    fireEvent.click(screen.getByRole('button', { name: /host a workshop|continue your listing/i }));
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
  it('a link for the other path (a shared ?type= link) does not open an unfinished draft of the other path', async () => {
    openForm();
    val(/event title/i, 'In person thing');
    await flush();
    cleanup();
    render(<HostWorkshopButton saveDraft defaultOpen initialPath="class" />);
    await waitFor(() => screen.getByLabelText(/class title/i));
    expect((screen.getByLabelText(/class title/i) as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/restored your saved draft/i)).toBeNull();
  });
  it('an untouched default price plan is not content: opening the class form and closing it saves nothing', async () => {
    openForm({ path: 'class' }); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
  it('restores the chosen languages as chips', async () => {
    openForm({ path: 'class' });
    val(/class title/i, 'Flow'); val(/about the class/i, 'Calm'); next();
    val(/online platform/i, 'Zoom'); val(/start date/i, '2099-01-05'); fireEvent.click(screen.getByLabelText('Mon')); val(/class time/i, '07:00'); next();
    fireEvent.click(screen.getByRole('combobox', { name: /languages/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Tamil' })); fireEvent.click(screen.getByRole('option', { name: 'Hindi' }));
    await flush();
    cleanup();
    openForm({ path: 'class' });
    await screen.findByRole('button', { name: /remove tamil/i });
    expect(screen.getByRole('button', { name: /remove hindi/i })).toBeTruthy();
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
  it('the draft note and Start over sit with the other buttons at the bottom', async () => {
    openForm();
    val(/event title/i, 'Old'); await flush();
    cleanup(); openForm();
    await waitFor(() => screen.getByText(/restored your saved draft/i));
    const bar = screen.getByText(/restored your saved draft/i).closest('.admin-actions')!;
    expect(bar).not.toBeNull();
    expect(bar.querySelector('button.host-start-over')).not.toBeNull();
    expect(bar.querySelector('button.primary')).not.toBeNull();
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
  it('a draft saved a moment before the send cannot come back after it', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    openForm();
    val(/event title/i, 'T'); val(/^type/i, 'workshop'); val(/what happens/i, 'd'); next();
    val(/start date/i, '2099-01-05'); val(/^city/i, 'x'); val(/venue/i, 'v'); next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: /send details/i })); // no pause: the auto-save timer is still waiting
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await flush();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await flush();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: /host a workshop|continue your listing/i }));
    val(/event title/i, 'T'); await flush();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('reminding someone about an unfinished listing', () => {
  const draftWithTitle = async (props: object = {}) => {
    openForm(props);
    val(/event title/i, 'Clay day'); await flush();
    cleanup();
  };
  const page = () => render(<><HostDraftReminder /><HostWorkshopButton saveDraft reminderTarget /></>);
  beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', '/workshops'); });

  it('a small modal in the middle of the page names the draft and when it was saved, with Continue, Discard and Not now', async () => {
    await draftWithTitle();
    page();
    const dlg = await screen.findByRole('dialog', { name: /finish your listing/i });
    expect(dlg.textContent).toMatch(/unfinished listing: Clay day/);
    expect(dlg.textContent).toMatch(/Saved (just now|\d+ \w+ ago)/);
    for (const n of [/^continue/i, /^discard/i, /^not now/i]) expect(within(dlg).getByRole('button', { name: n })).toBeTruthy();
    expect(dlg.textContent).not.toMatch(/asha|@|\d{10}/i);
  });
  it('the button reads Continue your listing, and there is no inline note any more', async () => {
    await draftWithTitle();
    page();
    await screen.findByRole('dialog', { name: /finish your listing/i });
    expect(screen.getAllByRole('button', { name: /continue your listing/i }).length).toBeGreaterThan(0);
    expect(document.querySelector('.host-continue-note')).toBeNull();
  });
  it('Continue closes the modal and opens the form at the saved step, whichever path the button starts on', async () => {
    openForm({ path: 'class' });
    val(/class title/i, 'Flow'); val(/about the class/i, 'Calm'); next(); await flush();
    cleanup();
    page();
    fireEvent.click(within(await screen.findByRole('dialog', { name: /finish your listing/i })).getByRole('button', { name: /^continue/i }));
    await waitFor(() => screen.getByText('Step 2 of 3'));
    expect((screen.getByLabelText('Online class') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('dialog', { name: /finish your listing/i })).toBeNull();
  });
  it('Discard deletes the draft; the button goes back to Host a workshop', async () => {
    await draftWithTitle();
    page();
    fireEvent.click(within(await screen.findByRole('dialog', { name: /finish your listing/i })).getByRole('button', { name: /^discard/i }));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => screen.getByRole('button', { name: /^host a workshop/i }));
  });
  it('Not now (or Escape) closes it, keeps the draft, and does not ask again in this browser session', async () => {
    await draftWithTitle();
    page();
    fireEvent.click(within(await screen.findByRole('dialog', { name: /finish your listing/i })).getByRole('button', { name: /^not now/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    cleanup(); page();
    await waitFor(() => screen.getByRole('button', { name: /continue your listing/i }));
    expect(screen.queryByRole('dialog', { name: /finish your listing/i })).toBeNull();
    sessionStorage.clear(); cleanup(); page();
    await screen.findByRole('dialog', { name: /finish your listing/i });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /finish your listing/i })).toBeNull();
  });
  it('does not appear when the page was opened by a link that opens the form itself (?type=)', async () => {
    await draftWithTitle();
    window.history.replaceState(null, '', '/workshops?type=in-person');
    page();
    await waitFor(() => screen.getByRole('button', { name: /continue your listing/i }));
    expect(screen.queryByRole('dialog', { name: /finish your listing/i })).toBeNull();
  });
  it('does not appear when nothing was typed, after a send, or when there is no draft', async () => {
    page();
    await waitFor(() => screen.getByRole('button', { name: /^host a workshop/i }));
    expect(screen.queryByRole('dialog', { name: /finish your listing/i })).toBeNull();
  });
  it('shows no button change unless the page turned drafts on', async () => {
    await draftWithTitle();
    render(<HostWorkshopButton />);
    expect(screen.getByRole('button', { name: /^host a workshop/i })).toBeTruthy();
  });
  it('closing the form with something typed turns the button into Continue your listing at once', async () => {
    openForm(); val(/event title/i, 'Half done');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: /continue your listing/i })).toBeTruthy();
  });
  it('opening the form and closing it with nothing typed leaves no draft', async () => {
    openForm(); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: /^host a workshop/i })).toBeTruthy();
  });
  it('sending the details removes the draft and the Continue button', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    openForm();
    val(/event title/i, 'T'); val(/^type/i, 'workshop'); val(/what happens/i, 'd'); next();
    val(/start date/i, '2099-01-05'); val(/^city/i, 'x'); val(/venue/i, 'v'); next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: /^host a workshop/i })).toBeTruthy();
  });
});

describe('timeAgo', () => {
  const now = 1_000_000_000_000;
  it('says just now, minutes, hours and days', () => {
    expect(timeAgo(now - 20_000, now)).toBe('just now');
    expect(timeAgo(now - 60_000, now)).toBe('1 minute ago');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 hours ago');
    expect(timeAgo(now - 86_400_000, now)).toBe('1 day ago');
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe('3 days ago');
  });
});
