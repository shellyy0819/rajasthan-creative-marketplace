// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const session = vi.hoisted(() => ({ value: { data: null as any, status: 'unauthenticated' } }));
const store = vi.hoisted(() => ({ reserve: vi.fn(async () => undefined), closeBooking: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: () => session.value, signIn: vi.fn() }));
vi.mock('@/components/StoreProvider', () => ({ useStore: () => ({ booking: { id: 'w9', title: 'Lac Craft', type: 'PAID', seats: 8, booked: 2 }, closeBooking: store.closeBooking, reserve: store.reserve }) }));
import { BookingDialog } from '@/components/BookingDialog';

beforeEach(() => {
  session.value = { data: null, status: 'unauthenticated' }; store.reserve.mockClear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
const name = () => screen.getByLabelText(/your name/i) as HTMLInputElement;
const email = () => screen.getByLabelText(/^email/i) as HTMLInputElement;

describe('the Reserve a spot form', () => {
  it('fills in the name and the email of a signed-in visitor', () => {
    session.value = { data: { user: { name: 'Asha Rao', email: 'asha@example.com' } }, status: 'authenticated' };
    render(<BookingDialog />);
    expect(name().value).toBe('Asha Rao');
    expect(email().value).toBe('asha@example.com');
  });
  it('leaves both empty for a visitor who is not signed in (they are asked to sign in), and the name is still required', () => {
    render(<BookingDialog />);
    expect(name().value).toBe('');
    expect(email().value).toBe('');
    expect(name().required).toBe(true);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeTruthy();
  });
  it('a Google account without a name still fills the email and leaves the name to type', () => {
    session.value = { data: { user: { email: 'asha@example.com' } }, status: 'authenticated' };
    render(<BookingDialog />);
    expect(name().value).toBe('');
    expect(email().value).toBe('asha@example.com');
  });
  it('fills in when the session arrives after the dialog opened', () => {
    const { rerender } = render(<BookingDialog />);
    expect(name().value).toBe('');
    session.value = { data: { user: { name: 'Asha Rao', email: 'asha@example.com' } }, status: 'authenticated' };
    rerender(<BookingDialog />);
    expect(name().value).toBe('Asha Rao');
    expect(email().value).toBe('asha@example.com');
  });
  it('the visitor can change the prefilled name, and the reservation is sent with what the form holds', async () => {
    session.value = { data: { user: { name: 'Asha Rao', email: 'asha@example.com' } }, status: 'authenticated' };
    render(<BookingDialog />);
    fireEvent.change(name(), { target: { value: 'Asha R' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reserve spot' })); });
    expect(store.reserve).toHaveBeenCalledWith({ workshopId: 'w9', attendeeName: 'Asha R', email: 'asha@example.com', quantity: 1 });
  });
});
