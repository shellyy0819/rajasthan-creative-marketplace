'use client';
import { useEffect, useRef } from 'react';
import { gaEvent } from '@/lib/analytics';
import { sendEvent, type TrackType } from '@/lib/track';

/** Records one event for this product when the page appears (strict-mode safe). Renders nothing. */
export function TrackOnMount({ productId, type }: { productId: string; type: TrackType }) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const key = `${type}:${productId}`;
    if (last.current === key) return;
    last.current = key;
    sendEvent(type, productId);
    if (type === 'view') gaEvent('view_item', { item_id: productId }); // contact and artist-credit events have their own GA events
  }, [productId, type]);
  return null;
}
