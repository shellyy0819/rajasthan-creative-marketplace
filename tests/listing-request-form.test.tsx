// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { ListingRequestButton } from '@/components/ListingRequestButton';

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
beforeEach(() => { fetchMock = vi.fn(() => reply(201, { ok: true })); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const open = () => { render(<ListingRequestButton />); fireEvent.click(screen.getByRole('button', { name: /List your craft/ })); return screen.getByRole('dialog'); };
const set = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillAll = () => { set(/^Owner name/, 'Meera Sharma'); set(/^Phone number/, '99898 98999'); set(/^Email/, ' Meera@Pottery.in '); set(/^Business or brand name/, 'Meera Pottery'); set(/^Business size/, 'medium'); };

describe('ListingRequestButton', () => {
  it('is a button that announces a dialog; the old "I’m a maker" mailto link is not rendered', () => {
    render(<ListingRequestButton />);
    const b = screen.getByRole('button', { name: /List your craft/ }) as HTMLButtonElement;
    expect(b.type).toBe('button'); expect(b.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });
  it('shows the seven fields: owner, phone, email, brand, optional instagram and website, size', () => {
    const d = open();
    for (const l of [/^Owner name/, /^Phone number/, /^Email/, /^Business or brand name/, /^Instagram handle/, /^Website/, /^Business size/]) expect(within(d).getByLabelText(l)).toBeTruthy();
    const size = within(d).getByLabelText(/^Business size/) as HTMLSelectElement;
    expect(Array.from(size.options).map(o => o.value)).toEqual(['', 'small', 'medium', 'large']);
  });
  it('marks mandatory fields (owner, phone, email, brand, size) required with a red-asterisk label and leaves instagram/website optional', () => {
    const d = open();
    for (const l of [/^Owner name/, /^Phone number/, /^Email/, /^Business or brand name/, /^Business size/]) {
      const el = within(d).getByLabelText(l) as HTMLInputElement; expect(el.required).toBe(true);
      expect(el.closest('label')!.querySelector('.lbl')).toBeTruthy();
    }
    for (const l of [/^Instagram handle/, /^Website/]) expect((within(d).getByLabelText(l) as HTMLInputElement).required).toBe(false);
  });
  it('the email is a required email-type field that explains it is the Google account used to sign in', () => {
    const d = open();
    const email = within(d).getByLabelText(/^Email/) as HTMLInputElement;
    expect(email.type).toBe('email'); expect(email.required).toBe(true); expect(email.autocomplete).toBe('email');
    fireEvent.change(email, { target: { value: 'nope' } }); expect(email.validity.typeMismatch).toBe(true);
    fireEvent.change(email, { target: { value: 'meera@pottery.in' } }); expect(email.validity.typeMismatch).toBe(false);
    expect(email.closest('label')!.textContent).toMatch(/Google account/);
  });
  it('validates the phone with the Indian mobile pattern in the browser', () => {
    const d = open();
    const phone = within(d).getByLabelText(/^Phone number/) as HTMLInputElement;
    for (const bad of ['12345', '5989898999', 'abcdefghij']) { fireEvent.change(phone, { target: { value: bad } }); expect(phone.validity.patternMismatch).toBe(true); }
    for (const good of ['9989898999', '+91 99898 98999']) { fireEvent.change(phone, { target: { value: good } }); expect(phone.validity.patternMismatch).toBe(false); }
    expect(phone.type).toBe('tel');
  });
  it('submits JSON to /api/listing-requests with trimmed values, then shows a thank-you with the phone and a Done button', async () => {
    const d = open(); fillAll(); set(/^Instagram handle/, ' @meerapottery '); set(/^Website/, 'meerapottery.in');
    fireEvent.submit(d.querySelector('form')!);
    await waitFor(() => expect(screen.getByText(/Thank you, Meera Sharma/)).toBeTruthy());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/listing-requests'); expect(init.method).toBe('POST'); expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ ownerName: 'Meera Sharma', phone: '99898 98999', email: 'Meera@Pottery.in', instagram: '@meerapottery', website: 'meerapottery.in', businessName: 'Meera Pottery', size: 'medium', companyWebsite: '' });
    expect(screen.getByText(/99898 98999/)).toBeTruthy();
    expect(screen.getByText(/sign in with Google using Meera@Pottery\.in/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('shows the server message and keeps what was typed when the request fails; a network error says so', async () => {
    const d = open(); fillAll();
    fetchMock.mockImplementationOnce(() => reply(400, { error: 'phone must be a valid Indian mobile number, e.g. 9989898999.' }));
    fireEvent.submit(d.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/phone must be a valid/));
    expect((screen.getByLabelText(/^Owner name/) as HTMLInputElement).value).toBe('Meera Sharma');
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    fireEvent.submit(d.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Network error/));
    fetchMock.mockImplementationOnce(() => reply(429, { error: 'Too many requests.' }));
    fireEvent.submit(d.querySelector('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Too many requests/));
  });
  it('ignores a second submit while one is in flight and shows the busy state', async () => {
    const d = open(); fillAll();
    let release!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>(r => { release = r; }));
    fireEvent.submit(d.querySelector('form')!); fireEvent.submit(d.querySelector('form')!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Sending/ }).getAttribute('aria-busy')).toBe('true');
    release({ ok: true, status: 201, json: () => Promise.resolve({ ok: true }) } as Response);
    await waitFor(() => expect(screen.getByText(/Thank you/)).toBeTruthy());
  });
  it('has a hidden honeypot that real visitors never reach (not focusable, hidden from screen readers)', () => {
    const d = open();
    const hp = d.querySelector('input[name="companyWebsite"]') as HTMLInputElement;
    expect(hp.tabIndex).toBe(-1); expect(hp.closest('[aria-hidden="true"]')).toBeTruthy(); expect(hp.autocomplete).toBe('off');
  });
  it('closes with Escape, the close button and the backdrop, and returns focus to the button', () => {
    const d = open(); const trigger = screen.getByRole('button', { name: /List your craft/ });
    fireEvent.click(d); expect(screen.queryByRole('dialog')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Close' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(trigger); fireEvent.click(document.querySelector('.contact-backdrop')!); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('reopening after a thank-you starts with an empty form', async () => {
    const d = open(); fillAll(); fireEvent.submit(d.querySelector('form')!);
    await waitFor(() => expect(screen.getByText(/Thank you/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /List your craft/ }));
    expect((screen.getByLabelText(/^Owner name/) as HTMLInputElement).value).toBe('');
  });
});
