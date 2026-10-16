// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const store = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/components/StoreProvider', () => ({ useStore: () => store.value }));
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { email: 'b@x.co' } }, status: 'authenticated' }), signIn: vi.fn() }));
import { CartDialog } from '@/components/CartDialog';
import { BookingDialog } from '@/components/BookingDialog';

afterEach(() => { cleanup(); });
// jsdom has no <dialog>.showModal
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };

describe('checkout and booking buttons', () => {
  it('"Place demo order" shows a busy ring and cannot be clicked twice while the order is pending', async () => {
    let release!: () => void;
    const checkout = vi.fn(() => new Promise<void>(r => { release = r; }));
    store.value = { items: [{ productId: 'p1', name: 'Bag', pricePaise: 100, quantity: 1 }], total: 100, removeFromCart: vi.fn(), cartOpen: true, setCartOpen: vi.fn(), checkout };
    render(<CartDialog />);
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Bee' } });
    const btn = screen.getByRole('button', { name: 'Place demo order', hidden: true });
    fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('true'));
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(checkout).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
  it('"Reserve demo spot" shows a busy ring while the booking is pending', async () => {
    let release!: () => void;
    const reserve = vi.fn(() => new Promise<void>(r => { release = r; }));
    store.value = { booking: { id: 'w1', type: 'FREE', seats: 10, booked: 1 }, closeBooking: vi.fn(), reserve };
    render(<BookingDialog />);
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Bee' } });
    const btn = screen.getByRole('button', { name: 'Reserve demo spot', hidden: true });
    fireEvent.click(btn);
    await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('true'));
    release();
    await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
  });
  it('the busy ring is cleared even when the request throws', async () => {
    const checkout = vi.fn(() => Promise.reject(new Error('net')));
    store.value = { items: [], total: 0, removeFromCart: vi.fn(), cartOpen: true, setCartOpen: vi.fn(), checkout };
    render(<CartDialog />);
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Bee' } });
    const btn = screen.getByRole('button', { name: 'Place demo order', hidden: true });
    fireEvent.click(btn);
    await waitFor(() => expect(checkout).toHaveBeenCalled());
    await waitFor(() => expect(btn.getAttribute('aria-busy')).not.toBe('true'));
  });
});
