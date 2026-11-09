// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';

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
const finish = () => { fireEvent.click(btn()); fireEvent.click(screen.getByRole('button', { name: 'Got it, finish' })); };

describe('onboarding submit', () => {
  const pending = () => { onboarding = () => new Promise(() => {}); };
  const form = () => btn().closest('form')!;

  it('two submits in the same tick send one request (the in-flight ref guard)', async () => {
    pending();
    await openStep2();
    fireEvent.click(btn());
    const ok = screen.getByRole('button', { name: 'Got it, finish' });
    act(() => { fireEvent.click(ok); fireEvent.click(ok); }); // one batch: no re-render between them, so only the guards can stop the second
    expect(posts).toBe(1);
  });
  it('a submit while pending is ignored and the button is disabled and busy (state guards)', async () => {
    pending();
    await openStep2();
    finish();
    await waitFor(() => expect(btn().disabled).toBe(true));
    expect(btn().getAttribute('aria-busy')).toBe('true');
    fireEvent.click(btn());
    expect(posts).toBe(1);
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(c => c[0] === '/api/onboarding')!;
    expect(JSON.parse(call[1].body)).toMatchObject({ fullName: 'Meera Rao', brandName: 'Meera Pottery', cityRef: 'REF-KOTA' });
  });
  it('a form submit while pending (the Enter-key path) sends no second request', async () => {
    pending();
    await openStep2();
    finish();
    await waitFor(() => expect(btn().disabled).toBe(true));
    fireEvent.submit(form()); // a keyboard Enter would take this path
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

  it('editing one field clears only that field server error; the others stay', async () => {
    onboarding = async () => reply(422, { errors: { brandName: 'Brand taken.', category: 'That category was removed.' } });
    await openStep2(); finish();
    const input = await screen.findByLabelText('Business or brand name');
    await screen.findByText('That category was removed.');
    fireEvent.change(input, { target: { value: 'Other' } });
    expect(screen.queryByText('Brand taken.')).toBeNull();
    expect(screen.getByText('That category was removed.')).toBeTruthy();
  });

  it('focus moves to the new step heading on Continue and Back, but not on first mount', async () => {
    render(<SellerOnboarding {...props} />);
    expect(document.activeElement).toBe(document.body);
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Step 2 of 2: Your craft');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Tell customers about your craft' }));
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    await screen.findByText('Step 1 of 2: You');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Tell us about you' }));
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

  it('401 writes the typed draft before redirecting and keeps the button locked', async () => {
    onboarding = async () => reply(401, { error: 'Sign in required.' });
    await openStep2();
    fireEvent.change(screen.getByLabelText('Business or brand name'), { target: { value: 'Typed Name' } });
    sessionStorage.removeItem(KEY); // prove the 401 path itself writes the draft
    finish();
    await waitFor(() => expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/sell' }));
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({ step: 2, fullName: 'Meera Rao', craft: { brandName: 'Typed Name' } });
    expect(btn().disabled).toBe(true);
  });
  it('a failed sign-in redirect shows the retry notice and unlocks the button', async () => {
    onboarding = async () => reply(401, { error: 'Sign in required.' });
    signInMock.mockRejectedValueOnce(new Error('boom'));
    await openStep2(); finish();
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    await waitFor(() => expect(btn().disabled).toBe(false));
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
    expect(document.querySelector('.onboard-lead')?.textContent).toMatch(/Meera Pottery is ready/);
    expect(document.querySelector('.onboard-lead strong.onboard-brand')?.textContent).toBe('Meera Pottery');
    expect(screen.getByRole('link', { name: 'Add your first product' }).getAttribute('href')).toBe(props.postsUrlNew);
    expect(screen.getByRole('link', { name: 'Go to my dashboard' }).getAttribute('href')).toBe(props.postsUrl);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('success moves focus to the heading', async () => {
    await openStep2(); finish();
    const h = await screen.findByRole('heading', { name: 'You are in, Meera.' });
    await waitFor(() => expect(document.activeElement).toBe(h));
  });
  it('a 422 that returns to step 1 focuses the first offending field', async () => {
    onboarding = async () => reply(422, { errors: { fullName: 'Enter your full name.', mobile: 'Enter a 10-digit mobile number.' } });
    await openStep2(); finish();
    await screen.findByText('Step 1 of 2: You');
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[name="fullName"]')));
  });

  const KEYS: [string, Partial<typeof craft>][] = [
    ['brandName', {}], ['category', {}], ['description', {}], ['cityRef', {}], ['instagram', {}], ['website', {}], ['logoUrl', {}],
    ['contactMethods', {}], ['whatsapp', { contactMethods: ['whatsapp'] } as never], ['whatsapp', {}],
  ];
  it.each(KEYS)('a 422 for %s (%j) leaves a visible message', async (key, over) => {
    onboarding = async () => reply(422, { errors: { [key]: `msg-${key}` } });
    sessionStorage.setItem(KEY, JSON.stringify({ email: 'c@x.co', step: 2, fullName: 'Meera Rao', mobile: '9876543210', craft: { ...craft, ...over } }));
    render(<SellerOnboarding {...props} />);
    await screen.findByText('Step 2 of 2: Your craft');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Textiles' })).toBeTruthy());
    finish();
    const msg = await screen.findByText(`msg-${key}`);
    expect(msg.closest('[role="alert"]')).toBeTruthy();
  });
});
