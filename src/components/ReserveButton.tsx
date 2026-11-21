'use client';
import type { Workshop } from '@/lib/types';
import { gaReserve } from '@/lib/ga-events';
import { useStore } from './StoreProvider';

export function ReserveButton({ workshop }: { workshop: Workshop }) {
  const { openBooking } = useStore();
  const full = (workshop.seats ?? 0) - workshop.booked < 1;
  return <button disabled={full} onClick={() => { gaReserve('open', { workshopId: workshop.id, free: workshop.type === 'FREE' }); openBooking(workshop); }}>{full ? 'Full' : 'Reserve spot ↗'}</button>;
}
