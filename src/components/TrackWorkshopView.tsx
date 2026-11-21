'use client';
import { useEffect, useRef } from 'react';
import { gaViewWorkshop } from '@/lib/ga-events';

/** Reports `view_item` once when a workshop page appears (strict-mode safe). Renders nothing. */
export function TrackWorkshopView({ workshopId, category, contentType }: { workshopId: string; category?: string; contentType: 'class' | 'workshop' }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === workshopId) return;
    last.current = workshopId;
    gaViewWorkshop({ workshopId, category, contentType });
  }, [workshopId, category, contentType]);
  return null;
}
