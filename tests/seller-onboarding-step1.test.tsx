// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const signInMock = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({ signIn: signInMock }));
import { SellerWelcome } from '@/components/SellerWelcome';
import { SellerOnboarding } from '@/components/SellerOnboarding';

const props = { initialName: 'Chai Maker', initialEmail: 'c@x.co', postsUrl: '/dashboard/posts', postsUrlNew: '/dashboard/posts?new=1' };

beforeEach(() => { signInMock.mockReset(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('seller welcome', () => {
  it('welcome button calls signIn with callbackUrl /sell', () => {
    render(<SellerWelcome />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/sell' });
  });
});

describe('onboarding step 1', () => {
  it('step 1 shows prefilled name and read-only email', () => {
    render(<SellerOnboarding {...props} />);
    expect(screen.getByText('Step 1 of 2: You')).toBeTruthy();
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Chai Maker');
    const email = screen.getByLabelText(/Email address/) as HTMLInputElement;
    expect(email.value).toBe('c@x.co');
    expect(email.readOnly).toBe(true);
    expect(screen.getByText('Verified by Google')).toBeTruthy();
  });
  it('blank name shows error and aria-invalid', () => {
    render(<SellerOnboarding {...props} initialName="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const input = screen.getByLabelText('Full name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const id = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(id)?.textContent).toMatch(/full name/i);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Asha' } });
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(document.getElementById(id)).toBeNull();
  });
  it('short mobile shows "Enter a 10-digit mobile number."', () => {
    render(<SellerOnboarding {...props} />);
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a 10-digit mobile number.')).toBeTruthy();
    expect(screen.getByLabelText(/Mobile number/).getAttribute('aria-invalid')).toBe('true');
  });
  it('valid step 1 advances to step 2', () => {
    render(<SellerOnboarding {...props} />);
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
  });
  it('refreshing restores draft from sessionStorage', async () => {
    const first = render(<SellerOnboarding {...props} />);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Edited Name' } });
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '9876543210' } });
    first.unmount();
    render(<SellerOnboarding {...props} />);
    await waitFor(() => expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Edited Name'));
    expect((screen.getByLabelText(/Mobile number/) as HTMLInputElement).value).toBe('9876543210');
  });
  it('draft survives a remount inside StrictMode', async () => {
    const first = render(<React.StrictMode><SellerOnboarding {...props} /></React.StrictMode>);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Strict Name' } });
    first.unmount();
    render(<React.StrictMode><SellerOnboarding {...props} /></React.StrictMode>);
    await waitFor(() => expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Strict Name'));
  });
  it('a draft is not applied over what the user already typed', async () => {
    sessionStorage.setItem('craftofy.onboarding', JSON.stringify({ email: 'c@x.co', step: 1, fullName: 'Old', mobile: '9999999999' }));
    const getItem = Storage.prototype.getItem;
    // The user types at the moment the restore effect reads storage.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Typed' } });
      return getItem.call(this, k);
    });
    render(<SellerOnboarding {...props} />);
    await new Promise(r => setTimeout(r, 20));
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Typed');
    expect((screen.getByLabelText(/Mobile number/) as HTMLInputElement).value).toBe('');
  });
  it('ignores a draft saved for a different email', async () => {
    sessionStorage.setItem('craftofy.onboarding', JSON.stringify({ email: 'other@x.co', step: 2, fullName: 'Someone Else', mobile: '9876543210' }));
    render(<SellerOnboarding {...props} />);
    await new Promise(r => setTimeout(r, 20));
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Chai Maker');
    expect(screen.getByText('Step 1 of 2: You')).toBeTruthy();
  });
  it('works when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<SellerOnboarding {...props} />);
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
  });
});
