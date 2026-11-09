// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SellerOnboarding } from '@/components/SellerOnboarding';
import type { Craft } from '@/components/onboarding/StepCraft';

const props = { initialName: 'Chai Maker', initialEmail: 'c@x.co', postsUrl: '/dashboard/posts', postsUrlNew: '/dashboard/posts?new=1' };
const LOGO = 'https://cdn.example/logos/u1/a.png';
const valid: Craft = {
  brandName: 'Meera Pottery', category: 'Pottery', newCategory: '', description: 'Hand-thrown mugs.', city: { ref: 'REF-KOTA', label: 'Kota, Rajasthan', state: 'Rajasthan' },
  instagram: '@meerapottery', website: '', logoUrl: LOGO, contactMethods: ['instagram'], sameAsMobile: true, whatsapp: '',
};
const KOTA = [{ label: 'Kota, Rajasthan', name: 'Kota', state: 'Rajasthan', ref: 'REF-KOTA' }];

const onSubmit = vi.fn(); // receives the body of every POST /api/onboarding
beforeEach(() => {
  onSubmit.mockReset();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: unknown) => {
    if (url === '/api/categories') return { ok: true, status: 200, json: () => Promise.resolve(['Pottery', 'Textiles']) } as Response;
    if (url.startsWith('/api/places')) return { ok: true, status: 200, json: () => Promise.resolve(KOTA) } as Response;
    if (url === '/api/uploads/seller-logo') return { ok: false, status: 500, json: () => Promise.resolve({}) } as Response;
    if (url === '/api/onboarding') { onSubmit(JSON.parse((init as RequestInit).body as string)); return { ok: true, status: 200, json: () => Promise.resolve({ status: 'ok' }) } as Response; }
    return { ok: false, status: 404, json: () => Promise.resolve({}) } as Response;
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** Opens step 2 with a saved draft (the same path a refresh takes), overriding fields of an otherwise valid craft. */
async function openStep2(over: Partial<Craft> = {}) {
  sessionStorage.setItem('craftofy.onboarding', JSON.stringify({ email: 'c@x.co', step: 2, fullName: 'Chai Maker', mobile: '9876543210', craft: { ...valid, ...over } }));
  render(<SellerOnboarding {...props} />);
  await screen.findByText('Step 2 of 2: Your craft');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Textiles' })).toBeTruthy());
  return onSubmit;
}
// Finish opens the draft-review notice when Step 2 is valid (see seller-onboarding-notice.test.tsx); confirm it to reach the submit.
const finish = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Finish and add my first product' }));
  const ok = screen.queryByRole('button', { name: 'Got it, finish' });
  if (ok) fireEvent.click(ok);
};
/** The error text linked to a control through aria-describedby, and that the control is flagged invalid. */
function errorOf(control: HTMLElement) {
  expect(control.getAttribute('aria-invalid')).toBe('true');
  const ids = control.getAttribute('aria-describedby')!.split(' ');
  return ids.map(id => document.getElementById(id)).find(el => el?.getAttribute('role') === 'alert')?.textContent;
}

describe('onboarding step 2 errors', () => {
  it('a valid craft submits the payload and no error shows', async () => {
    await openStep2();
    finish();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      fullName: 'Chai Maker', mobile: '9876543210', brandName: 'Meera Pottery', category: 'Pottery', description: 'Hand-thrown mugs.',
      cityRef: 'REF-KOTA', instagram: 'meerapottery', logoUrl: LOGO, contactMethods: ['instagram'],
    }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('blank brand name shows its error and focuses it', async () => {
    await openStep2({ brandName: '  ' });
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
    await openStep2({ description: 'a'.repeat(201) });
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
  it('logo is optional: no marker, no error, and Finish submits without a logoUrl', async () => {
    await openStep2({ logoUrl: '' });
    expect(screen.getByRole('heading', { name: 'Logo or profile photo (optional)' })).toBeTruthy();
    finish();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('logoUrl');
    expect(screen.queryByText('Upload your logo.')).toBeNull();
  });
  it('a failed logo upload does not block Finish, which submits without a logo', async () => {
    await openStep2({ logoUrl: '' });
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 500, height: 500, close: () => {} })));
    const f = new File(['x'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [f] } });
    expect(await screen.findByText('The photo could not be uploaded.')).toBeTruthy();
    // The error text renders a tick before LogoUpload's busy=false reaches the form (passive effect), so wait for Finish
    // to be enabled; clicking it while still disabled is a no-op and made this test flaky. It still fails if a failed upload leaves Finish disabled.
    const finishBtn = screen.getByRole('button', { name: 'Finish and add my first product' }) as HTMLButtonElement;
    await waitFor(() => expect(finishBtn.disabled).toBe(false));
    finish();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('logoUrl');
  });
  it('an upload in progress still blocks Finish', async () => {
    await openStep2({ logoUrl: '' });
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise(() => {}))); // the check never ends
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } });
    await screen.findByText('Uploading…');
    finish();
    expect(onSubmit).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Finish and add my first product' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('no contact method shows the required message', async () => {
    await openStep2({ contactMethods: [] });
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
    await openStep2({ contactMethods: ['whatsapp'], sameAsMobile: true });
    finish();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
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
    await openStep2({ city: null });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Kota' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Kota, Rajasthan' }, { timeout: 2000 }));
    const state = screen.getByLabelText('State') as HTMLInputElement;
    expect(state.value).toBe('Rajasthan');
    expect(state.readOnly).toBe(true);
    finish();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
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

describe('onboarding step 2 accessibility and drafts', () => {
  it('the counter is not a live region and only crossing 200 adds one status', async () => {
    await openStep2({ description: '' });
    const area = screen.getByLabelText('Short description');
    const counter = screen.getByTestId('description-counter');
    expect(counter.closest('[aria-live]')).toBeNull();
    const live = () => document.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
    const before = live().length;
    fireEvent.change(area, { target: { value: 'a'.repeat(100) } });
    fireEvent.change(area, { target: { value: 'a'.repeat(200) } });
    expect(counter.textContent).toBe('200 / 200');
    expect(live().length).toBe(before);
    fireEvent.change(area, { target: { value: 'a'.repeat(201) } });
    expect(screen.getAllByRole('status').filter(e => /over 200/.test(e.textContent ?? ''))).toHaveLength(1);
    fireEvent.change(area, { target: { value: 'a'.repeat(205) } });
    expect(screen.getAllByRole('status').filter(e => /over 200/.test(e.textContent ?? ''))).toHaveLength(1);
    fireEvent.change(area, { target: { value: 'a'.repeat(150) } });
    expect(screen.queryByText(/is over 200/)).toBeNull();
  });
  it('a malformed stored draft renders the form normally', async () => {
    sessionStorage.setItem('craftofy.onboarding', JSON.stringify({
      email: 'c@x.co', step: 2, fullName: 'Chai Maker', mobile: '9876543210',
      craft: { brandName: 42, contactMethods: 'whatsapp', city: 'Kota', description: null, sameAsMobile: 'yes', website: { a: 1 } },
    }));
    render(<SellerOnboarding {...props} />);
    await screen.findByText('Step 2 of 2: Your craft');
    expect((screen.getByLabelText('Business or brand name') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Phone' }).getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByLabelText('City') as HTMLInputElement).value).toBe('');
  });
});

function fetchMock422(msg: string) {
  const prev = globalThis.fetch as unknown as (u: string, i?: unknown) => Promise<Response>;
  vi.stubGlobal('fetch', vi.fn(async (u: string, i?: unknown) =>
    u === '/api/onboarding' ? ({ ok: false, status: 422, json: () => Promise.resolve({ errors: { category: msg } }) } as Response) : prev(u, i)));
}

describe('onboarding step 2: Other category', () => {
  const OTHER = 'Other (add a new category)';
  const pick = (v: string) => fireEvent.change(screen.getByLabelText('Category'), { target: { value: v } });
  const typed = () => screen.queryByLabelText('Your category') as HTMLInputElement | null;

  it('Other is the last option; choosing it reveals "Your category", focused, with its helper', async () => {
    await openStep2();
    const select = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(select.options[select.options.length - 1].textContent).toBe(OTHER);
    expect(typed()).toBeNull();
    pick(select.options[select.options.length - 1].value);
    const input = typed()!;
    expect(input.required).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('Tell us what you make')).toBeTruthy();
  });
  it('picking a list category hides the input again but keeps the typed text in the draft', async () => {
    await openStep2({ category: '__other__', newCategory: 'Bamboo Craft' });
    expect(typed()!.value).toBe('Bamboo Craft');
    pick('Textiles');
    expect(typed()).toBeNull();
    const saved = JSON.parse(sessionStorage.getItem('craftofy.onboarding')!);
    expect(saved.craft).toMatchObject({ category: 'Textiles', newCategory: 'Bamboo Craft' });
    pick('__other__');
    expect(typed()!.value).toBe('Bamboo Craft');
  });
  it('a restored draft keeps Other selected and its text; focus is not stolen on restore', async () => {
    await openStep2({ category: '__other__', newCategory: 'Bamboo Craft' });
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('__other__');
    expect(typed()!.value).toBe('Bamboo Craft');
    expect(document.activeElement).not.toBe(typed());
  });
  it('empty Other shows the required error at the input, focused and described', async () => {
    await openStep2({ category: '__other__', newCategory: '  ' });
    finish();
    expect(errorOf(typed()!)).toBe('Enter your category.');
    expect(document.activeElement).toBe(typed());
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('a name over 40 characters, or with a bad character, shows the rule error and does not submit', async () => {
    await openStep2({ category: '__other__', newCategory: 'a'.repeat(41) });
    finish();
    expect(errorOf(typed()!)).toMatch(/2-40 characters/);
    fireEvent.change(typed()!, { target: { value: '<b>x</b>' } });
    expect(errorOf(typed()!)).toMatch(/2-40 characters/);
    fireEvent.change(typed()!, { target: { value: 'Bamboo Craft' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('the payload carries the trimmed typed name', async () => {
    await openStep2({ category: '__other__', newCategory: '  Bamboo   Craft ' });
    finish();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].category).toBe('Bamboo Craft');
  });
  it('a name matching an existing category in another case submits the canonical spelling', async () => {
    await openStep2({ category: '__other__', newCategory: 'pOTTERY ' });
    finish();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].category).toBe('Pottery');
  });
  it('a server error on category shows at the typed input', async () => {
    await openStep2({ category: '__other__', newCategory: 'Bamboo Craft' });
    fetchMock422('Category limit reached (100).');
    finish();
    await screen.findByText('Category limit reached (100).');
    expect(errorOf(typed()!)).toBe('Category limit reached (100).');
  });
});
