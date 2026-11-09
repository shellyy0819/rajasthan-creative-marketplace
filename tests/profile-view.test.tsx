// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('@/components/onboarding/LogoUpload', () => ({
  LogoUpload: ({ onChange }: { onChange: (u: string) => void }) => <button type="button" onClick={() => onChange('https://cdn.example.com/logos/me.png')}>pick logo</button>,
}));
import { ProfileView } from '@/components/ProfileView';
import type { SellerProfile } from '@/lib/types';

const P: SellerProfile = { userId: 'u', displayName: 'Meera Pottery', category: 'Pottery', city: 'Kota', bio: 'Hand-thrown mugs.', publicEmail: 'm@x.co', publicPhone: '9876543210', instagram: '@meera', contactMethods: ['whatsapp', 'instagram'], onboardedAt: '2026-11-01T00:00:00Z' };
const res = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
let fetchMock: ReturnType<typeof vi.fn>;
const onLogoSaved = vi.fn(), onClose = vi.fn();
const open = (p: SellerProfile = P) => render(<ProfileView profile={p} onLogoSaved={onLogoSaved} onClose={onClose} />);
beforeEach(() => { onLogoSaved.mockReset(); onClose.mockReset(); fetchMock = vi.fn(() => res(200, { ...P, logoUrl: 'https://cdn.example.com/logos/me.png' })); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('ProfileView', () => {
  it('shows the details as text with the lock note and no editable fields or save-profile button', () => {
    open();
    expect(screen.getByText('Your details are locked. Contact Craftofy to change them.')).toBeTruthy();
    for (const t of ['Meera Pottery', 'Pottery', 'Kota', 'Hand-thrown mugs.', 'm@x.co', '9876543210', '@meera', 'WhatsApp, Instagram']) expect(screen.getByText(t)).toBeTruthy();
    expect(document.querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
  });
  it('with a stored logo it shows it and offers no upload', () => {
    open({ ...P, logoUrl: 'https://cdn.example.com/logos/me.png' });
    expect((screen.getByAltText('Your logo') as HTMLImageElement).src).toBe('https://cdn.example.com/logos/me.png');
    expect(screen.queryByText('pick logo')).toBeNull();
  });
  it('without a logo it offers an upload; Save logo stays off until one is picked, then PUTs only the logo', async () => {
    open();
    const save = screen.getByRole('button', { name: 'Save logo' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByText('pick logo'));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(onLogoSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/profile/logo');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ logoUrl: 'https://cdn.example.com/logos/me.png' });
  });
  it('shows the server message when saving the logo fails and lets the seller retry', async () => {
    fetchMock.mockImplementationOnce(() => res(400, { error: 'Upload your logo.' }));
    open();
    fireEvent.click(screen.getByText('pick logo'));
    fireEvent.click(screen.getByRole('button', { name: 'Save logo' }));
    expect(await screen.findByText('Upload your logo.')).toBeTruthy();
    expect(onLogoSaved).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Save logo' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('Close and Escape close it', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('My profile on the posts page', () => {
  it('an onboarded seller sees My profile and gets the read-only view; an onboarded admin still gets the edit form', async () => {
    const { PostsAdmin } = await import('@/components/PostsAdmin');
    const common = { initialProducts: [], initialArtists: [], categories: ['Pottery'], workshops: [], sellers: [], me: { name: 'M', email: 'm@x.co' } } as unknown as Omit<React.ComponentProps<typeof PostsAdmin>, 'role' | 'profile'>;
    const locked = { ...P, logoUrl: 'https://cdn.example.com/logos/me.png' };
    const r = render(<PostsAdmin {...common} role="seller" profile={locked} />);
    fireEvent.click(screen.getByRole('button', { name: 'My profile' }));
    expect(screen.getByText('Your details are locked. Contact Craftofy to change them.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull();
    r.unmount();
    render(<PostsAdmin {...common} role="admin" profile={locked} />);
    fireEvent.click(screen.getByRole('button', { name: 'My profile' }));
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeTruthy();
  });
});
