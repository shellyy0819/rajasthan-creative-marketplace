// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: ({ required }: { required?: boolean }) => <input aria-label="City" name="cityRef" required={required} /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <input type="hidden" name="images" value="https://img.test/a.jpg" /> }));
vi.mock('@/components/RequestReceived', () => ({ RequestReceived: () => <p>received</p> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';
import { hostPath, wantsHostForm } from '@/lib/host-link';

const fetchMock = vi.fn();
const topics = [{ id: 1, name: 'Yoga' }, { id: 2, name: 'Crochet' }];
const val = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^next/i }));
const stepText = () => screen.getByText(/^Step \d of 3$/).textContent;
const openClass = () => { render(<HostWorkshopButton path="class" topics={topics} />); fireEvent.click(screen.getByRole('button', { name: /host a workshop/i })); };

function classStep1() { val(/event title|class title/i, 'Morning Flow'); val(/what happens|about the class/i, 'Gentle hatha yoga.'); }
function classStep2() {
  val(/online platform/i, 'Zoom'); val(/start date/i, '2027-01-05');
  fireEvent.click(screen.getByLabelText('Mon')); fireEvent.click(screen.getByLabelText('Wed'));
  val(/class time/i, '07:00');
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); window.history.replaceState(null, '', '/workshops'); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('host-link helpers', () => {
  it('?host=class means the class path, ?host=1 means open with no choice, anything else is closed', () => {
    expect(hostPath({ host: 'class' })).toBe('class');
    expect(hostPath({ host: '1' })).toBeNull();
    expect(hostPath({ host: 'in-person' })).toBe('event');
    expect(hostPath({ type: 'in-person' })).toBe('event');
    expect(hostPath({ type: 'online' })).toBe('class');
    expect(wantsHostForm({ type: 'online' })).toBe(true);
    expect(wantsHostForm({ type: 'FREE' })).toBe(false);
    expect(wantsHostForm({ type: 'in-person' })).toBe(true);
    expect(wantsHostForm({ host: 'in-person' })).toBe(true);
    expect(hostPath({})).toBeNull();
    expect(wantsHostForm({ host: 'class' })).toBe(true);
    expect(wantsHostForm({ host: '1' })).toBe(true);
    expect(wantsHostForm({ host: 'yes' })).toBe(false);
  });
});

describe('step 1: what are you hosting?', () => {
  it('opened by a shared ?host=1 link there is no choice yet and Next is blocked', () => {
    render(<HostWorkshopButton defaultOpen initialPath={null} topics={topics} />);
    expect((screen.getByLabelText('In-person event') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Online class') as HTMLInputElement).checked).toBe(false);
    next();
    expect(stepText()).toBe('Step 1 of 3');
  });
  it('the generic button starts on the in-person path with the Type select', () => {
    render(<HostWorkshopButton topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect((screen.getByLabelText('In-person event') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText(/^type/i)).toBeTruthy();
  });
  it('the online class path has no Type select and offers the topics', () => {
    openClass();
    expect((screen.getByLabelText('Online class') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText(/^type/i)).toBeNull();
    const opts = Array.from((screen.getByLabelText('Topic') as HTMLSelectElement).options).map(o => o.textContent);
    expect(opts).toEqual(['Other', 'Yoga', 'Crochet']);
  });
  it('switching the choice keeps the title and description', () => {
    openClass(); classStep1();
    fireEvent.click(screen.getByLabelText('In-person event'));
    expect((screen.getByLabelText(/event title/i) as HTMLInputElement).value).toBe('Morning Flow');
  });
});

describe('step 2 and 3 on the online class path', () => {
  it('asks for platform, days, time, duration and price plans, and not city, venue or seats', () => {
    openClass(); classStep1(); next();
    expect(stepText()).toBe('Step 2 of 3');
    for (const l of [/online platform/i, /start date/i, /class time/i, /duration/i]) expect(screen.getByLabelText(l)).toBeTruthy();
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) expect(screen.getByLabelText(d)).toBeTruthy();
    expect(screen.queryByLabelText(/venue/i)).toBeNull();
    expect(screen.queryByLabelText(/^city/i)).toBeNull();
    expect(screen.queryByLabelText(/^seats/i)).toBeNull();
  });
  it('Next needs at least one class day', () => {
    openClass(); classStep1(); next();
    val(/online platform/i, 'Zoom'); val(/start date/i, '2027-01-05'); val(/class time/i, '07:00');
    next();
    expect(stepText()).toBe('Step 2 of 3');
    expect(screen.getByRole('alert').textContent).toMatch(/class day/i);
  });
  it('the price editor adds up to five plans and removes them', () => {
    openClass(); classStep1(); next();
    const add = () => screen.getByRole('button', { name: /add a price plan/i });
    for (let i = 0; i < 5; i++) fireEvent.click(add());
    expect(screen.getAllByLabelText(/^Plan \d name$/)).toHaveLength(5);
    expect((add() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove plan 5' }));
    expect(screen.getAllByLabelText(/^Plan \d name$/)).toHaveLength(4);
  });
  it('step 3 adds languages, level, experience, certifications and WhatsApp', () => {
    openClass(); classStep1(); next(); classStep2(); next();
    expect(stepText()).toBe('Step 3 of 3');
    for (const l of [/languages/i, /^level/i, /experience/i, /certifications/i, /whatsapp/i]) expect(screen.getByLabelText(l)).toBeTruthy();
  });
  it('sends the class payload: mode online, kind class, schedule, price plans in paise, languages, level, whatsapp, topic', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'asha@example.com', status: 'pending' }) });
    openClass();
    val('Topic', '1'); classStep1(); next(); classStep2(); val(/meeting link/i, 'https://zoom.us/j/123');
    fireEvent.click(screen.getByRole('button', { name: /add a price plan/i }));
    fireEvent.change(screen.getByLabelText('Plan 1 name'), { target: { value: 'Monthly' } });
    fireEvent.change(screen.getByLabelText('Plan 1 price (Rs.)'), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText('Plan 1 sessions'), { target: { value: '12' } });
    val(/free trial length/i, '7');
    next();
    val(/host, studio/i, 'Asha Yoga'); val(/your name/i, 'Asha Rao'); val(/phone number/i, '9989898999'); val(/^email/i, 'asha@example.com');
    val(/languages/i, 'Hindi, English'); val(/^level/i, 'beginner'); val(/experience/i, '8 years'); val(/certifications/i, 'RYT 500'); val(/whatsapp/i, '9989898999');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      mode: 'online', kind: 'class', topicId: 1, title: 'Morning Flow', platform: 'Zoom', startDate: '2027-01-05', freeTrial: true,
      schedule: { days: ['mon', 'wed'], time: '07:00', durationMin: 60 }, prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }],
      languages: ['Hindi', 'English'], level: 'beginner', experience: '8 years', certifications: 'RYT 500', whatsapp: '9989898999', hostName: 'Asha Yoga', joinLink: 'https://zoom.us/j/123',
    });
    expect(body.cityRef).toBeUndefined();
    expect(body.venue).toBeUndefined();
  });
});

describe('free trial length', () => {
  it('there is no free trial tick box: an optional "how many days" field is the free trial, sent as freeTrial and freeTrialDays', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    openClass(); classStep1(); next(); classStep2();
    expect(screen.queryByLabelText(/offers a free trial/i)).toBeNull();
    val(/free trial length/i, '7');
    next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co'); val(/whatsapp/i, '9989898999');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ freeTrial: true, freeTrialDays: 7 });
  });
  it('the field is optional: blank sends no freeTrialDays', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    openClass(); classStep1(); next(); classStep2(); next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co'); val(/whatsapp/i, '9989898999');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.freeTrialDays).toBeUndefined();
    expect(body.freeTrial).toBe(false);
  });
});

describe('all weeks of the month', () => {
  const toMonthly = () => { openClass(); classStep1(); next(); fireEvent.change(screen.getByLabelText('Repeats'), { target: { value: 'monthly' } }); };
  it('the "All weeks" chip switches Repeats to Every week', () => {
    toMonthly();
    fireEvent.click(screen.getByRole('button', { name: 'All weeks' }));
    expect((screen.getByLabelText('Repeats') as HTMLSelectElement).value).toBe('weekly');
    expect(screen.queryByLabelText('1st')).toBeNull();
  });
  it('ticking every week by hand does the same, but four of five stays monthly', () => {
    toMonthly();
    for (const w of ['1st', '2nd', '3rd', '4th']) fireEvent.click(screen.getByLabelText(w));
    expect((screen.getByLabelText('Repeats') as HTMLSelectElement).value).toBe('monthly');
    fireEvent.click(screen.getByLabelText('Last'));
    expect((screen.getByLabelText('Repeats') as HTMLSelectElement).value).toBe('weekly');
  });
});

describe('duration', () => {
  const toDuration = () => { openClass(); classStep1(); next(); val(/online platform/i, 'Zoom'); val(/start date/i, '2027-01-05'); fireEvent.click(screen.getByLabelText('Mon')); val(/class time/i, '07:00'); };
  it('is a number you type plus a Minutes / Hours dropdown, starting at 60 minutes', () => {
    toDuration();
    expect((screen.getByLabelText(/duration/i) as HTMLInputElement).value).toBe('60');
    const unit = screen.getByLabelText('Minutes or hours') as HTMLSelectElement;
    expect(Array.from(unit.options).map(o => o.textContent)).toEqual(['mins', 'hours']);
    expect(unit.value).toBe('mins');
  });
  it('1.5 hours is sent as 90 minutes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    toDuration();
    val(/duration/i, '1.5'); fireEvent.change(screen.getByLabelText('Minutes or hours'), { target: { value: 'hours' } });
    next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co'); val(/whatsapp/i, '9989898999');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).schedule.durationMin).toBe(90);
  });
  it('shorter than 15 minutes or longer than 8 hours is refused on the step', () => {
    toDuration();
    val(/duration/i, '10'); next();
    expect(stepText()).toBe('Step 2 of 3');
    expect(screen.getByRole('alert').textContent).toMatch(/15 minutes and 8 hours/i);
    fireEvent.change(screen.getByLabelText('Minutes or hours'), { target: { value: 'hours' } });
    val(/duration/i, '9'); next();
    expect(stepText()).toBe('Step 2 of 3');
  });
});

describe('how often a class repeats', () => {
  it('weekly is the default; Every month asks which weeks, needs one, and sends repeat and weeks', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    openClass(); classStep1(); next();
    const repeat = screen.getByLabelText('Repeats') as HTMLSelectElement;
    expect(Array.from(repeat.options).map(o => o.textContent)).toEqual(['Every week', 'Every month']);
    expect(repeat.value).toBe('weekly');
    expect(screen.queryByLabelText('1st')).toBeNull();
    fireEvent.change(repeat, { target: { value: 'monthly' } });
    for (const w of ['1st', '2nd', '3rd', '4th', 'Last']) expect(screen.getByLabelText(w)).toBeTruthy();
    val(/online platform/i, 'Zoom'); val(/start date/i, '2027-01-05'); fireEvent.click(screen.getByLabelText('Sat')); val(/class time/i, '07:00');
    next();
    expect(stepText()).toBe('Step 2 of 3');
    expect(screen.getByRole('alert').textContent).toMatch(/week of the month/i);
    fireEvent.click(screen.getByLabelText('1st')); fireEvent.click(screen.getByLabelText('3rd'));
    next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co'); val(/whatsapp/i, '9989898999');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).schedule).toEqual({ repeat: 'monthly', days: ['sat'], weeks: [1, 3], time: '07:00', durationMin: 60 });
  });
});

describe('price: free or paid', () => {
  it('is a dropdown that starts on Free; Paid shows the price box and sends PAID', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'a@b.co', status: 'pending' }) });
    render(<HostWorkshopButton topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    val(/event title/i, 'Clay'); val(/^type/i, 'workshop'); val(/what happens/i, 'Clay day'); next();
    const entry = screen.getByLabelText('Price') as HTMLSelectElement;
    expect(Array.from(entry.options).map(o => o.textContent)).toEqual(['Free', 'Paid']);
    expect(entry.value).toBe('free');
    expect(screen.queryByLabelText(/price per person/i)).toBeNull();
    expect(screen.queryByLabelText(/pay to attend/i)).toBeNull();
    fireEvent.change(entry, { target: { value: 'paid' } });
    val(/price per person/i, '499'); val(/start date/i, '2099-01-05'); val(/^city/i, 'x'); val(/venue/i, 'Studio');
    next();
    val(/host, studio/i, 'H'); val(/your name/i, 'N'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ priceType: 'PAID', priceRupees: 499 });
  });
});

describe('languages', () => {
  it('step 3 refuses more than five languages before anything is sent', () => {
    openClass(); classStep1(); next(); classStep2(); next();
    val(/host, studio/i, 'A'); val(/your name/i, 'B'); val(/phone number/i, '9989898999'); val(/^email/i, 'a@b.co');
    val(/languages/i, 'a1, b2, c3, d4, e5, f6');
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/five languages|5 languages/i);
  });
});

describe('address bar', () => {
  it('uses type=online while the class path is open and type=in-person otherwise', () => {
    render(<HostWorkshopButton path="class" shareable topics={topics} />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(window.location.search).toBe('?type=online');
    fireEvent.click(screen.getByLabelText('In-person event'));
    expect(window.location.search).toBe('?type=in-person');
  });
});

describe('the button label', () => {
  it('can be changed, e.g. Teach an online class', () => {
    render(<HostWorkshopButton path="class" label="Teach an online class" topics={topics} />);
    expect(screen.getByRole('button', { name: /teach an online class/i })).toBeTruthy();
  });
});
