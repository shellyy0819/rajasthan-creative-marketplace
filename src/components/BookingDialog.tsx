'use client';
import { useEffect, useRef } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useStore } from './StoreProvider';

export function BookingDialog() {
  const { booking, closeBooking, reserve } = useStore();
  const { data: session } = useSession();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (booking && !d.open) d.showModal();
    if (!booking && d.open) d.close();
  }, [booking]);
  const max = booking ? Math.min(4, booking.seats - booking.booked) : 1;
  return (
    <dialog ref={ref} onClose={closeBooking} aria-labelledby="booking-title">
      <div className="dialog-head">
        <h2 id="booking-title">{booking?.type === 'FREE' ? 'Reserve your free spot' : 'Reserve a spot'}</h2>
        <button className="icon-btn" onClick={closeBooking} aria-label="Close booking">✕</button>
      </div>
      {booking && (
        <form onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          await reserve({ workshopId: booking.id, attendeeName: String(f.get('attendeeName')), email: String(f.get('email')), quantity: Number(f.get('quantity')) });
          form.reset();
        }}>
          <label>Your name<input name="attendeeName" required placeholder="Name" /></label>
          <label>Email<input name="email" type="email" required placeholder="you@example.com" defaultValue={session?.user?.email ?? ''} /></label>
          <label>Number of seats
            <select name="quantity">
              {Array.from({ length: Math.max(1, max) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} seat{i ? 's' : ''}</option>)}
            </select>
          </label>
          {session?.user
            ? <button className="button primary full" type="submit">Reserve demo spot</button>
            : <button className="button primary full" type="button" onClick={() => signIn('google')}>Sign in with Google to reserve</button>}
          <p className="fine-print">Demo booking only. Paid workshops do not collect payment.</p>
        </form>
      )}
    </dialog>
  );
}
