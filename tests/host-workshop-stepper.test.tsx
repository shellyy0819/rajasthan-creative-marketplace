// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: ({ required }: { required?: boolean }) => <input aria-label="City" name="cityRef" required={required} /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <input type="hidden" name="images" value="https://img.test/a.jpg" /> }));
vi.mock('@/components/RequestReceived', () => ({ RequestReceived: () => <p>received</p> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';

const fetchMock = vi.fn();
const val = (label: RegExp | string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const next = () => fireEvent.click(screen.getByRole('button', { name: /^next/i }));
const back = () => fireEvent.click(screen.getByRole('button', { name: /^back/i }));
const open = () => { render(<HostWorkshopButton />); fireEvent.click(screen.getByRole('button', { name: /host a workshop/i })); };

function fillStep1() { val(/event title/i, 'Crochet night'); val(/^type/i, 'workshop'); val(/what happens/i, 'We crochet.'); }
function fillStep2() { val(/start date/i, '2026-12-01'); val(/^city/i, 'Jaipur'); val(/venue and address/i, '12 MI Road'); }
function fillStep3() { val(/host, studio/i, 'Studio X'); val(/your name/i, 'Asha Rao'); val(/phone number/i, '9989898999'); val(/^email/i, 'asha@example.com'); }

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Host a workshop stepper', () => {
  it('starts on step 1 of 3 with only the event fields', () => {
    open();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /event title/i })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /venue and address/i })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /your name/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^next/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^back/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /send details/i })).toBeNull();
  });

  it('marks the current step in the progress list', () => {
    open();
    const steps = within(screen.getByRole('list', { name: /progress/i })).getAllByRole('listitem');
    expect(steps.map(s => s.textContent)).toEqual(['The event', 'When and where', 'About you']);
    expect(steps[0].getAttribute('aria-current')).toBe('step');
    expect(steps[1].getAttribute('aria-current')).toBeNull();
  });

  it('Next stays on step 1 while a required field is empty', () => {
    open();
    next();
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /venue and address/i })).toBeNull();
  });

  it('Enter on step 1 does not send the form and does not skip ahead when it is incomplete', () => {
    open();
    fireEvent.submit(screen.getByRole('textbox', { name: /event title/i }).closest('form')!);
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Enter on a complete step 1 goes to step 2 instead of sending', () => {
    open(); fillStep1();
    fireEvent.submit(screen.getByRole('textbox', { name: /event title/i }).closest('form')!);
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('moves forward and back without losing what was typed', () => {
    open(); fillStep1(); next();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /venue and address/i })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /event title/i })).toBeNull();
    back();
    expect((screen.getByRole('textbox', { name: /event title/i }) as HTMLInputElement).value).toBe('Crochet night');
  });

  it('moves focus to the first field of the new step', () => {
    open(); fillStep1(); next();
    expect(document.activeElement).toBe(screen.getByLabelText(/start date/i));
  });

  it('the last step has Send details instead of Next, and sends the fields of all three steps once', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'r1', email: 'asha@example.com', status: 'pending' }) });
    open(); fillStep1(); next(); fillStep2(); next(); fillStep3();
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^next/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/workshop-requests');
    expect(JSON.parse(init.body)).toMatchObject({ title: 'Crochet night', kind: 'workshop', venue: '12 MI Road', startDate: '2026-12-01', hostName: 'Studio X', contactName: 'Asha Rao', phone: '9989898999', email: 'asha@example.com', images: ['https://img.test/a.jpg'] });
    await waitFor(() => expect(screen.getByRole('heading', { name: /verify your email/i })).toBeTruthy());
  });

  it('a server error shows on step 3 and keeps every answer', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Phone looks wrong' }) });
    open(); fillStep1(); next(); fillStep2(); next(); fillStep3();
    fireEvent.click(screen.getByRole('button', { name: /send details/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Step 3 of 3')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: /your name/i }) as HTMLInputElement).value).toBe('Asha Rao');
  });

  it('opens on step 1 again after being closed on a later step', () => {
    open(); fillStep1(); next();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
  });
});
