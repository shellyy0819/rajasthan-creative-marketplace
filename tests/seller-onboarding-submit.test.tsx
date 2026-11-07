// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const signInMock = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ signIn: signInMock }));
import { SellerOnboarding } from '@/components/SellerOnboarding';

const props = { initialName: 'Meera Rao', initialEmail: 'c@x.co', postsUrl: 'https://dash.example/dashboard/posts', postsUrlNew: 'https://dash.example/dashboard/posts?new=1' };
const LOGO = 'https://cdn.example/logos/u1/a.png';
const craft = {
  brandName: 'Meera Pottery', category: 'Pottery', description: 'Hand-thrown mugs.', city: { ref: 'REF-KOTA', label: 'Kota, Rajasthan', state: 'Rajasthan' },
  instagram: '@meerapottery', website: '', logoUrl: LOGO, contactMethods: ['instagram'], sameAsMobile: true, whatsapp: '',
};
const KEY = 'craftofy.onboarding';
let onboarding: (() => Promise<unknown>) | null;
let posts: number;

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: () => (body === undefined ? Promise.reject(new SyntaxError('x')) : Promise.resolve(body)) }) as Response;

beforeEach(() => {
  sessionStorage.clear(); signInMock.mockReset(); posts = 0;
  onboarding = async () => reply(200, { status: 'ok' });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/categories') return reply(200, ['Pottery', 'Textiles']);
    if (url.startsWith('/api/places')) return reply(200, []);
    if (url === '/api/onboarding') { posts++; return onboarding!(); }
    return reply(404, {});
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openStep2() {
  sessionStorage.setItem(KEY, JSON.stringify({ email: 'c@x.co', step: 2, fullName: 'Meera Rao', mobile: '9876543210', craft }));
  render(<SellerOnboarding {...props} />);
  await screen.findByText('Step 2 of 2: Your craft');
  await waitFor(() => expect(screen.getByRole('option', { name: 'Textiles' })).toBeTruthy());
}
const btn = () => screen.getByRole('button', { name: 'Finish and add my first product' }) as HTMLButtonElement;
const finish = () => fireEvent.click(btn());

describe('onboarding submit', () => {
  it('finish posts once even if clicked twice', async () => {
    let release!: () => void;
    onboarding = () => new Promise(r => { release = () => r(reply(200, { status: 'ok' })); });
    await openStep2();
    finish(); finish();
    fireEvent.submit(btn().closest('form')!);
    await waitFor(() => expect(btn().disabled).toBe(true));
    expect(btn().getAttribute('aria-busy')).toBe('true');
    expect(posts).toBe(1);
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(c => c[0] === '/api/onboarding')!;
    expect(JSON.parse(call[1].body)).toMatchObject({ fullName: 'Meera Rao', brandName: 'Meera Pottery', cityRef: 'REF-KOTA' });
    release();
    await screen.findByText('You are in, Meera.');
    expect(posts).toBe(1);
  });

  it('422 shows server errors on fields and stays on step 2 when only step 2 fields are wrong', async () => {
    onboarding = async () => reply(422, { errors: { brandName: 'Brand taken.' } });
    await openStep2(); finish();
    const input = await screen.findByLabelText('Business or brand name');
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(input.getAttribute('aria-describedby')!.split(' ')[0])!.textContent).toBe('Brand taken.');
    expect(screen.getByText('Step 2 of 2: Your craft')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Other' } });
    expect(screen.queryByText('Brand taken.')).toBeNull();
  });

  it('422 returns to step 1 when name or mobile is wrong', async () => {
    onboarding = async () => reply(422, { errors: { mobile: 'Enter a 10-digit mobile number.', brandName: 'Brand taken.' } });
    await openStep2(); finish();
    await screen.findByText('Step 1 of 2: You');
    const mobile = document.querySelector('[name="mobile"]')!;
    expect(mobile.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a 10-digit mobile number.')).toBeTruthy();
  });

  it('a 422 form error is visible', async () => {
    onboarding = async () => reply(422, { errors: { form: 'Invalid request.' } });
    await openStep2(); finish();
    expect((await screen.findByText('Invalid request.')).closest('[role="alert"]')).toBeTruthy();
    expect(btn().disabled).toBe(false);
  });

  it('401 keeps the draft and starts sign-in', async () => {
    onboarding = async () => reply(401, { error: 'Sign in required.' });
    await openStep2(); finish();
    await waitFor(() => expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/sell' }));
    expect(JSON.parse(sessionStorage.getItem(KEY)!).craft.brandName).toBe('Meera Pottery');
  });

  it('403 shows the message', async () => {
    onboarding = async () => reply(403, { error: 'Account is deactivated.' });
    await openStep2(); finish();
    expect(await screen.findByText('Account is deactivated.')).toBeTruthy();
    expect(signInMock).not.toHaveBeenCalled();
    expect(btn().disabled).toBe(false);
  });

  it('429 shows retry and re-enables the button', async () => {
    onboarding = async () => reply(429, { error: 'Too many requests.' });
    await openStep2(); finish();
    expect(await screen.findByText(/try again/i)).toBeTruthy();
    expect(btn().disabled).toBe(false);
  });

  it('network error shows retry and re-enables the button', async () => {
    onboarding = async () => { throw new TypeError('offline'); };
    await openStep2(); finish();
    expect(await screen.findByText(/check your connection and try again/i)).toBeTruthy();
    expect(btn().disabled).toBe(false);
    onboarding = async () => reply(200, { status: 'ok' });
    finish();
    await screen.findByText('You are in, Meera.');
    expect(posts).toBe(2);
  });

  it('a non-JSON 502 shows a generic retry message', async () => {
    onboarding = async () => reply(502, undefined);
    await openStep2(); finish();
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(btn().disabled).toBe(false);
  });

  it('success shows the done screen with both actions and clears the draft', async () => {
    await openStep2(); finish();
    expect(await screen.findByText('You are in, Meera.')).toBeTruthy();
    expect(screen.getByText(/Meera Pottery is ready/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add your first product' }).getAttribute('href')).toBe(props.postsUrlNew);
    expect(screen.getByRole('link', { name: 'Go to my dashboard' }).getAttribute('href')).toBe(props.postsUrl);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
