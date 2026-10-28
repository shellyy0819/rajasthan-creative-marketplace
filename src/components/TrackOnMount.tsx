'use client';
import { useEffect, useRef } from 'react';
import { gaEvent } from '@/lib/analytics';
import { sendEvent, type TrackType } from '@/lib/track';

const GA_NAMES: Record<TrackType, string> = { view: 'view_item', contact: 'contact_click', artist: 'artist_visit' };

/** Records one event for this product when the page appears (strict-mode safe). Renders nothing. */
export function TrackOnMount({ productId, type }: { productId: string; type: TrackType }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const key = `${type}:${productId}`;
    if (last.current === key) return;
    last.current = key;
    sendEvent(type, productId);
    gaEvent(GA_NAMES[type], { item_id: productId });
  }, [productId, type]);
  return null;
}
