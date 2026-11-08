// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import { SellerOnboarding } from '@/components/SellerOnboarding';
import { CityInput } from '@/components/CityInput';
import { sanitizeCraft } from '@/components/onboarding/StepCraft';

const props = { initialName: 'Chai Maker', initialEmail: 'c@x.co', postsUrl: '/dashboard/posts', postsUrlNew: '/dashboard/posts?new=1' };
const KOTA = [
  { label: 'Kota, Rajasthan', name: 'Kota', state: 'Rajasthan', ref: 'REF-KOTA' },
  { label: 'Kota, Chhattisgarh', name: 'Kota', state: 'Chhattisgarh', ref: 'REF-KOTA-CG' },
  { label: 'Kotdwar, Uttarakhand', name: 'Kotdwar', state: 'Uttarakhand', ref: 'REF-KOTDWAR' },
];
const craft = (city: unknown) => ({
  brandName: 'Meera Pottery', category: 'Pottery', newCategory: '', description: 'Hand-thrown mugs.', city,
  instagram: '@meerapottery', website: '', logoUrl: '', contactMethods: ['instagram'], sameAsMobile: true, whatsapp: '',
});
const onSubmit = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  onSubmit.mockReset();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: unknown) => {
    if (url === '/api/categories') return { ok: true, status: 200, json: () => Promise.resolve(['Pottery']) } as Response;
    if (url.startsWith('/api/places')) return { ok: true, status: 200, json: () => Promise.resolve(KOTA) } as Response;
    if (url === '/api/onboarding') { onSubmit(JSON.parse((init as RequestInit).body as string)); return { ok: true, status: 200, json: () => Promise.resolve({ status: 'ok' }) } as Response; }
    return { ok: false, status: 404, json: () => Promise.resolve({}) } as Response;
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function openStep2(city: unknown) {
  sessionStorage.setItem('craftofy.onboarding', JSON.stringify({ email: 'c@x.co', step: 2, fullName: 'Chai Maker', mobile: '9876543210', craft: craft(city) }));
  render(<SellerOnboarding {...props} />);
  await screen.findByText('Step 2 of 2: Your craft');
}
const cityBox = () => screen.getByLabelText('City') as HTMLInputElement;
const stateBox = () => screen.getByLabelText('State') as HTMLInputElement;
const type = async (v: string) => { fireEvent.change(cityBox(), { target: { value: v } }); await act(async () => { await vi.advanceTimersByTimeAsync(400); }); };

describe('onboarding city field shows only the name', () => {
  it('after a pick the input holds the name only and State shows the state; the list keeps City, State labels', async () => {
    await openStep2(null);
    await type('kot');
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)).toEqual(['Kota, Rajasthan', 'Kota, Chhattisgarh', 'Kotdwar, Uttarakhand']);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    expect(cityBox().value).toBe('Kota');
    expect(stateBox().value).toBe('Rajasthan');
    expect(document.querySelector<HTMLInputElement>('input[name="cityRef"]')?.value).toBe('REF-KOTA');
  });
  it('same-name cities in two states are told apart in the list and send their own ref', async () => {
    await openStep2(null);
    await type('kot');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Chhattisgarh' }));
    expect(cityBox().value).toBe('Kota');
    expect(stateBox().value).toBe('Chhattisgarh');
    expect(document.querySelector<HTMLInputElement>('input[name="cityRef"]')?.value).toBe('REF-KOTA-CG');
  });
  it('picking a different city updates both fields', async () => {
    await openStep2(null);
    await type('kot');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    await type('kotd');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kotdwar, Uttarakhand' }));
    expect(cityBox().value).toBe('Kotdwar');
    expect(stateBox().value).toBe('Uttarakhand');
  });
  it('typing again clears the state and the cityRef; typed text without a pick is not accepted', async () => {
    await openStep2(null);
    await type('kot');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    await type('Kot');
    expect(stateBox().value).toBe('');
    expect(document.querySelector('input[name="cityRef"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish and add my first product' }));
    expect(screen.getByText('Pick your city from the list.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('a restored draft shows the name and the state', async () => {
    await openStep2({ ref: 'REF-KOTA', label: 'Kota, Rajasthan', name: 'Kota', state: 'Rajasthan' });
    expect(cityBox().value).toBe('Kota');
    expect(stateBox().value).toBe('Rajasthan');
  });
  it('an old draft with only the combined label restores the name', async () => {
    await openStep2({ ref: 'REF-KOTA', label: 'Kota, Rajasthan', state: 'Rajasthan' });
    expect(cityBox().value).toBe('Kota');
    expect(stateBox().value).toBe('Rajasthan');
  });
  it('the draft stores ref, label, name and state after a pick', async () => {
    await openStep2(null);
    await type('kot');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('craftofy.onboarding')!).craft.city).toEqual({ ref: 'REF-KOTA', label: 'Kota, Rajasthan', name: 'Kota', state: 'Rajasthan' }));
  });
});

describe('sanitizeCraft city derivation', () => {
  const city = (c: unknown) => sanitizeCraft({ city: c }).city;
  it('splits on the last ", " only when the state is present and ends the label', () => {
    expect(city({ ref: 'r', label: 'Kota, Rajasthan', state: 'Rajasthan' })?.name).toBe('Kota');
    expect(city({ ref: 'r', label: 'Foo, Bar, Rajasthan', state: 'Rajasthan' })?.name).toBe('Foo, Bar');
    expect(city({ ref: 'r', label: 'Kota, Rajasthan' })?.name).toBe('Kota, Rajasthan');
    expect(city({ ref: 'r', label: 'Kota, Rajasthan', state: 'Gujarat' })?.name).toBe('Kota, Rajasthan');
  });
  it('keeps a stored name', () => {
    expect(city({ ref: 'r', label: 'Kota, Rajasthan', name: 'Kotah', state: 'Rajasthan' })?.name).toBe('Kotah');
  });
});

describe('CityInput default valueFormat is unchanged', () => {
  it('still shows the full label after a pick', async () => {
    render(<form><label><span className="lbl">City</span><CityInput /></label></form>);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kot' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Kota, Rajasthan' }));
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Kota, Rajasthan');
  });
});
