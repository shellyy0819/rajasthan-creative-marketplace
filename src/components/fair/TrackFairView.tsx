'use client';
import { useEffect, useRef } from 'react';
import { gaViewFair } from '@/lib/ga-events';

/** Reports `view_fair` (GA4) once when the Craftofy Fair page appears (strict-mode safe), open or closed. Renders nothing. */
export function TrackFairView({ status }: { status: 'open' | 'closed' }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    gaViewFair(status);
  }, [status]);
  return null;
}
