// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SellerOnboarding } from '@/components/SellerOnboarding';
import type { Craft } from '@/components/onboarding/StepCraft';

const props = { initialName: 'Chai Maker', initialEmail: 'c@x.co', postsUrl: '/dashboard/posts', postsUrlNew: '/dashboard/posts?new=1' };
const LOGO = 'https://cdn.example/logos/u1/a.png';
const valid: Craft = {
  brandName: 'Meera Pottery', category: 'Pottery', description: 'Hand-thrown mugs.', city: { ref: 'REF-KOTA', label: 'Kota, Rajasthan', state: 'Rajasthan' },
  instagram: '@meerapottery', website: '', logoUrl: LOGO, contactMethods: ['instagram'], sameAsMobile: true, whatsapp: '',
};
const KOTA = [{ label: 'Kota, Rajasthan', name: 'Kota', state: 'Rajasthan', ref: 'REF-KOTA' }];

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/categories') return { ok: true, status: 200, json: () => Promise.resolve(['Pottery', 'Textiles']) } as Response;
    if (url.startsWith('/api/places')) return { ok: true, status: 200, json: () => Promise.resolve(KOTA) } as Response;
    return { ok: false, status: 404, json: () => Promise.resolve({}) } as Response;
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** Opens step 2 with a saved draft (the same path a refresh takes), overriding fields of an otherwise valid craft. */
async function openStep2(over: Partial<Craft> = {}, onSubmit = vi.fn()) {
  sessionStorage.setItem('craftofy.onboarding', JSON.stringify({ email: 'c@x.co', step: 2, fullName: 'Chai Maker', mobile: '9876543210', craft: { ...valid, ...over } }));
  render(<SellerOnboarding {...props} onSubmit={onSubmit} />);
  await screen.findByText('Step 2 of 2: Your craft');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Textiles' })).toBeTruthy());
  return onSubmit;
}
const finish = () => fireEvent.click(screen.getByRole('button', { name: 'Finish and add my first product' }));
/** The error text linked to a control through aria-describedby, and that the control is flagged invalid. */
function errorOf(control: HTMLElement) {
  expect(control.getAttribute('aria-invalid')).toBe('true');
  const ids = control.getAttribute('aria-describedby')!.split(' ');
  return ids.map(id => document.getElementById(id)).find(el => el?.getAttribute('role') === 'alert')?.textContent;
}

describe('onboarding step 2 errors', () => {
  it('a valid craft submits the payload and no error shows', async () => {
    const onSubmit = await openStep2();
    finish();
    expect(onSubmit).toHaveBeenCalledWith({
      fullName: 'Chai Maker', mobile: '9876543210', brandName: 'Meera Pottery', category: 'Pottery', description: 'Hand-thrown mugs.',
      cityRef: 'REF-KOTA', instagram: 'meerapottery', logoUrl: LOGO, contactMethods: ['instagram'],
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('blank brand name shows its error and focuses it', async () => {
    const onSubmit = await openStep2({ brandName: '  ' });
    finish();
    const input = screen.getByLabelText('Business or brand name');
    expect(errorOf(input)).toBe('Enter your brand name.');
    expect(document.activeElement).toBe(input);
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('missing category shows its error', async () => {
    await openStep2({ category: '' });
    finish();
    expect(errorOf(screen.getByLabelText('Category'))).toBe('Enter a category.');
  });
  it('description over 200 shows its error, counter 201 / 200', async () => {
    const onSubmit = await openStep2({ description: 'a'.repeat(201) });
    expect(screen.getByText('201 / 200')).toBeTruthy();
    finish();
    expect(errorOf(screen.getByLabelText('Short description'))).toBe('A short description must be 200 characters or fewer.');
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('city not picked shows "Pick your city from the list." and typed text does not count', async () => {
    await openStep2({ city: null });
    const city = screen.getByLabelText('City');
    fireEvent.change(city, { target: { value: 'Kota' } });
    finish();
    expect(errorOf(city)).toBe('Pick your city from the list.');
  });
  it('neither instagram nor website shows the combined error', async () => {
    await openStep2({ instagram: '', website: '', contactMethods: ['phone'] });
    finish();
    expect(errorOf(screen.getByLabelText('Instagram'))).toBe('Add an Instagram handle or a website.');
  });
  it('logo missing shows "Upload your logo."', async () => {
    await openStep2({ logoUrl: '' });
    finish();
    expect(errorOf(screen.getByLabelText('Upload photo'))).toBe('Upload your logo.');
  });
  it('no contact method shows the required message', async () => {
    const onSubmit = await openStep2({ contactMethods: [] });
    finish();
    expect(screen.getByText('Choose at least one way for customers to reach you.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('invalid WhatsApp number shows its error', async () => {
    await openStep2({ contactMethods: ['whatsapp'], sameAsMobile: false, whatsapp: '12345' });
    finish();
    expect(errorOf(screen.getByLabelText(/WhatsApp number/))).toBe('Enter a valid WhatsApp number.');
  });
  it('a chosen Instagram contact method needs a handle', async () => {
    await openStep2({ instagram: '', website: 'https://x.co', contactMethods: ['instagram'] });
    finish();
    expect(errorOf(screen.getByLabelText('Instagram'))).toBe('Add your Instagram handle.');
  });
  it('errors clear as each field is fixed, and the first invalid field gets focus', async () => {
    await openStep2({ brandName: '', description: '' });
    finish();
    const brand = screen.getByLabelText('Business or brand name');
    expect(document.activeElement).toBe(brand);
    fireEvent.change(brand, { target: { value: 'Meera' } });
    expect(brand.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('Short description').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('onboarding step 2 behaviour', () => {
  it('description counter updates', async () => {
    await openStep2({ description: '' });
    expect(screen.getByText('0 / 200')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Short description'), { target: { value: 'Clay bowls' } });
    expect(screen.getByText('10 / 200')).toBeTruthy();
  });
  it('same-as-mobile copies and locks WhatsApp', async () => {
    await openStep2({ contactMethods: ['whatsapp'], sameAsMobile: false, whatsapp: '' });
    const wa = screen.getByLabelText(/WhatsApp number/) as HTMLInputElement;
    expect(wa.readOnly).toBe(false);
    fireEvent.click(screen.getByLabelText('Same as my mobile number'));
    expect(wa.value).toBe('9876543210');
    expect(wa.readOnly).toBe(true);
    fireEvent.click(screen.getByLabelText('Same as my mobile number'));
    expect(wa.readOnly).toBe(false);
  });
  it('WhatsApp submits the mobile when same-as-mobile is on', async () => {
    const onSubmit = await openStep2({ contactMethods: ['whatsapp'], sameAsMobile: true });
    finish();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ whatsapp: '9876543210', contactMethods: ['whatsapp'] });
  });
  it('contact toggles use aria-pressed', async () => {
    await openStep2({ contactMethods: [] });
    const phone = screen.getByRole('button', { name: 'Phone' });
    expect(phone.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(phone);
    expect(phone.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Phone uses your mobile number/)).toBeTruthy();
  });
  it('picking a city fills the read-only state and submits its ref', async () => {
    const onSubmit = await openStep2({ city: null });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Kota' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Kota, Rajasthan' }, { timeout: 2000 }));
    const state = screen.getByLabelText('State') as HTMLInputElement;
    expect(state.value).toBe('Rajasthan');
    expect(state.readOnly).toBe(true);
    finish();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ cityRef: 'REF-KOTA' });
  });
  it('edits are kept in the draft with the signed-in email', async () => {
    await openStep2();
    fireEvent.change(screen.getByLabelText('Business or brand name'), { target: { value: 'New Name' } });
    const saved = JSON.parse(sessionStorage.getItem('craftofy.onboarding')!);
    expect(saved).toMatchObject({ email: 'c@x.co', step: 2, craft: { brandName: 'New Name', logoUrl: LOGO } });
  });
  it('Back returns to step 1 with the craft kept', async () => {
    await openStep2();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1 of 2: You')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((screen.getByLabelText('Business or brand name') as HTMLInputElement).value).toBe('Meera Pottery');
  });
});
