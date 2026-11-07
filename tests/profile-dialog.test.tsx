// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProfileDialog } from '@/components/ProfileDialog';
import type { SellerProfile } from '@/lib/types';

const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let fetchMock: ReturnType<typeof vi.fn>;
let putResponse: () => Promise<Response>;
const onSaved = vi.fn();
const sent = () => JSON.parse(fetchMock.mock.calls.filter(c => c[1]?.method === 'PUT').at(-1)![1].body);
const open = (initial: Partial<SellerProfile> = {}) =>
  render(<ProfileDialog title="My profile" initial={{ userId: 'me', displayName: 'Shauk', ...initial }} url="/api/profile" onSaved={onSaved} onCancel={() => undefined} />);
const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

beforeEach(() => {
  onSaved.mockReset();
  putResponse = () => res(200, { userId: 'me', displayName: 'Shauk' });
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/categories') return res(200, ['Pottery', 'Textiles']);
    if (init?.method === 'PUT') return putResponse();
    return res(500, {});
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ProfileDialog onboarding fields', () => {
  it('renders the stored values and submits website, category, whatsapp, logo and contact methods', async () => {
    open({ website: 'https://old.example', category: 'Pottery', whatsapp: '9989898999', logoUrl: 'https://cdn.example.com/logo.png', contactMethods: ['whatsapp'] });
    expect((screen.getByLabelText(/^Website/) as HTMLInputElement).value).toBe('https://old.example');
    expect((screen.getByAltText('Your logo') as HTMLImageElement).src).toBe('https://cdn.example.com/logo.png');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Textiles' })).toBeTruthy());
    expect((screen.getByLabelText(/^Category/) as HTMLSelectElement).value).toBe('Pottery');
    expect(screen.getByRole('button', { name: 'WhatsApp' }).getAttribute('aria-pressed')).toBe('true');
    fill(/^Website/, 'https://shauk.co'); fill(/^Category/, 'Textiles'); fill(/^WhatsApp number/, '99898 98999');
    fireEvent.click(screen.getByRole('button', { name: 'Website' }));
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({ displayName: 'Shauk', website: 'https://shauk.co', category: 'Textiles', whatsapp: '99898 98999', logoUrl: 'https://cdn.example.com/logo.png', contactMethods: ['whatsapp', 'website'] });
  });

  it('works when none of the new fields exist: they are not sent at all', async () => {
    open();
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    for (const k of ['website', 'category', 'whatsapp', 'logoUrl', 'contactMethods']) expect(sent()).not.toHaveProperty(k);
  });
  it('clearing a stored value sends it empty so the server clears it', async () => {
    open({ website: 'https://old.example', contactMethods: ['website'] });
    fill(/^Website/, '');
    fireEvent.click(screen.getByRole('button', { name: 'Website' }));
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({ website: '', contactMethods: [] });
  });

  it('blocks a bad website in the browser with an inline error tied to the field', async () => {
    open();
    fill(/^Website/, 'ftp://x.co');
    save();
    const input = screen.getByLabelText(/^Website/);
    expect(await screen.findByText('Enter a website starting with http:// or https://.')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain('http');
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(false);
  });

  it('a contact method without its value shows the error next to that field', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    save();
    expect(await screen.findByText('Enter a valid WhatsApp number.')).toBeTruthy();
    expect(screen.getByLabelText(/^WhatsApp number/).getAttribute('aria-invalid')).toBe('true');
  });

  it('shows a server error that names a field next to that field, not in the banner', async () => {
    putResponse = () => res(400, { error: 'Upload your logo.', field: 'logoUrl' });
    open();
    save();
    const msg = await screen.findByText('Upload your logo.');
    expect(msg.closest('#err-profile-logoUrl')).toBeTruthy();
    expect(document.querySelector('.admin-error')).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('a server error without a field still shows in the top banner (existing behaviour)', async () => {
    putResponse = () => res(400, { error: 'publicEmail must be a valid email address.' });
    open();
    save();
    expect((await screen.findByRole('alert')).textContent).toContain('publicEmail must be a valid email address.');
  });

  describe('client-side checks before the PUT', () => {
    const puts = () => fetchMock.mock.calls.filter(c => c[1]?.method === 'PUT').length;
    it('a blank display name shows a message next to the field and focuses it, without calling the server', () => {
      open();
      fill(/^Display name/, '   '); save();
      const input = screen.getByLabelText(/^Display name/);
      expect(screen.getByText('Enter a display name.').closest('#err-profile-displayName')).toBeTruthy();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('err-profile-displayName');
      expect(document.activeElement).toBe(input);
      expect(puts()).toBe(0);
    });
    it('a bad public phone shows the phone hint inline', () => {
      open();
      fill(/^Public phone/, '12345'); save();
      expect(screen.getByText('Enter a valid Indian mobile number, e.g. 9989898999 or +91 99898 98999.').closest('#err-profile-publicPhone')).toBeTruthy();
      expect(screen.getByLabelText(/^Public phone/).getAttribute('aria-invalid')).toBe('true');
      expect(puts()).toBe(0);
    });
    it('a good phone with a separator passes', async () => {
      open();
      fill(/^Public phone/, '+91 99898 98999'); save();
      await waitFor(() => expect(puts()).toBe(1));
    });
    it('a bad public email shows a message inline', () => {
      open();
      fill(/^Public email/, 'not-an-email'); save();
      expect(screen.getByText('Enter a valid email address.').closest('#err-profile-publicEmail')).toBeTruthy();
      expect(screen.getByLabelText(/^Public email/).getAttribute('aria-invalid')).toBe('true');
      expect(puts()).toBe(0);
    });
    it('focus goes to the first invalid field in page order, and editing a field clears its message', () => {
      open();
      fill(/^Display name/, ''); fill(/^Public email/, 'x'); save();
      expect(document.activeElement).toBe(screen.getByLabelText(/^Display name/));
      fill(/^Display name/, 'Shauk');
      expect(screen.queryByText('Enter a display name.')).toBeNull();
      expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    });
  });

  it('existing fields still submit as before', async () => {
    open();
    fill(/^Display name/, 'New Name'); fill(/^Instagram/, 'newname'); fill(/^About the artist/, 'Potter.');
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({ displayName: 'New Name', instagram: 'newname', bio: 'Potter.', publicPhone: '', youtube: '' });
  });

  it('own profile offers the logo upload', () => {
    open({ logoUrl: 'https://cdn.example.com/l.png' });
    expect(screen.getByText('Replace photo')).toBeTruthy();
    expect(screen.queryByText('Only the seller can change their logo.')).toBeNull();
  });
  it('editing another seller: logo is read-only with a note and no logoUrl is sent', async () => {
    render(<ProfileDialog title="Profile of x" initial={{ userId: 'other', displayName: 'O', logoUrl: 'https://cdn.example.com/l.png' }} url="/api/admin/users/other/profile" canUploadLogo={false} onSaved={onSaved} onCancel={() => undefined} />);
    expect(screen.queryByText('Replace photo')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect((screen.getByAltText('Seller logo') as HTMLImageElement).src).toBe('https://cdn.example.com/l.png');
    expect(screen.getByText('Only the seller can change their logo.')).toBeTruthy();
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(sent()).not.toHaveProperty('logoUrl');
  });
  it('a website like example.com shows the inline error, not the browser bubble', async () => {
    open();
    expect(document.querySelector('form')!.noValidate).toBe(true);
    fill(/^Website/, 'example.com');
    save();
    expect(await screen.findByText('Enter a website starting with http:// or https://.')).toBeTruthy();
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(false);
  });
});
