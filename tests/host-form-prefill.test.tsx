// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));

import { HostWorkshopButton } from '@/components/HostWorkshopButton';

const fetchMock = vi.fn();
const me = { name: 'Asha Rao', email: 'asha@x.co', hostName: 'Asha Yoga', phone: '9989898999', whatsapp: '9989898999', instagram: '@asha.yoga', website: 'https://asha.yoga' };
const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
const open = (props: object = {}) => { render(<HostWorkshopButton prefill {...props} />); fireEvent.click(screen.getByRole('button', { name: /host a workshop/i })); };
const val = (l: RegExp) => (screen.getByLabelText(l) as HTMLInputElement).value;
const toLast = () => {
  const set = (l: RegExp, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
  set(/event title/i, 'T'); set(/^type/i, 'workshop'); set(/what happens/i, 'd');
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));
  set(/start date/i, '2099-01-01'); set(/^city/i, 'x'); set(/venue/i, 'v');
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));
};

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('pre-filling the host form for a signed-in person', () => {
  it('fills name, email, host name, phone, Instagram and website', async () => {
    fetchMock.mockResolvedValue(json(me));
    open(); toLast();
    await waitFor(() => expect(val(/your name/i)).toBe('Asha Rao'));
    expect(val(/^email/i)).toBe('asha@x.co');
    expect(val(/host, studio/i)).toBe('Asha Yoga');
    expect(val(/phone number/i)).toBe('9989898999');
    expect(val(/^instagram/i)).toBe('@asha.yoga');
    expect(val(/^website/i)).toBe('https://asha.yoga');
    expect(fetchMock).toHaveBeenCalledWith('/api/host-prefill', expect.anything());
  });
  it('fills the WhatsApp number on the class path', async () => {
    fetchMock.mockResolvedValue(json(me));
    open({ path: 'class' });
    const set = (l: RegExp, v: string) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    set(/class title/i, 'T'); set(/about the class/i, 'd'); fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    set(/online platform/i, 'Zoom'); set(/start date/i, '2099-01-01'); fireEvent.click(screen.getByLabelText('Mon')); set(/class time/i, '07:00');
    fireEvent.click(screen.getByRole('button', { name: /^next/i }));
    await waitFor(() => expect(val(/whatsapp/i)).toBe('9989898999'));
  });
  it('never overwrites something the visitor already typed', async () => {
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise(r => { resolve = r; }));
    open(); toLast();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Typed Name' } });
    resolve(json(me));
    await waitFor(() => expect(val(/^email/i)).toBe('asha@x.co'));
    expect(val(/your name/i)).toBe('Typed Name');
  });
  it('leaves the form empty for a visitor who is not signed in, or when the request fails', async () => {
    fetchMock.mockResolvedValue(json({}));
    open(); toLast();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(val(/your name/i)).toBe('');
    cleanup(); fetchMock.mockReset(); fetchMock.mockRejectedValue(new Error('down'));
    open(); toLast();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(val(/^email/i)).toBe('');
  });
  it('asks nothing unless the page turned prefill on', () => {
    render(<HostWorkshopButton />);
    fireEvent.click(screen.getByRole('button', { name: /host a workshop/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
