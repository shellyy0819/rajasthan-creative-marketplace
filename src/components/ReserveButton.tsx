'use client';
import type { Workshop } from '@/lib/types';
import { useStore } from './StoreProvider';

export function ReserveButton({ workshop }: { workshop: Workshop }) {
  const { openBooking } = useStore();
  const full = workshop.seats - workshop.booked < 1;
  return <button disabled={full} onClick={() => openBooking(workshop)}>{full ? 'Full' : 'Reserve spot ↗'}</button>;
}
