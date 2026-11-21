'use client';
import { useEffect, useRef } from 'react';
import { gaViewWorkshop } from '@/lib/ga-events';
import { sendWorkshopEvent } from '@/lib/track';

/** Reports `view_item` (GA4) and a first-party view once when a workshop page appears (strict-mode safe). Renders nothing. */
export function TrackWorkshopView({ workshopId, category, contentType }: { workshopId: string; category?: string; contentType: 'class' | 'workshop' }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === workshopId) return;
    last.current = workshopId;
    gaViewWorkshop({ workshopId, category, contentType });
    sendWorkshopEvent('view', workshopId); // the first-party count behind the Trending workshops row
  }, [workshopId, category, contentType]);
  return null;
}
