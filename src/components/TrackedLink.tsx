'use client';
import type { AnchorHTMLAttributes } from 'react';
import { gaContactSeller, type GaContactMethod } from '@/lib/ga-events';
import { sendEvent, type TrackType } from '@/lib/track';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { productId: string; type: TrackType; href: string; sellerSlug?: string; method?: GaContactMethod };

/** A normal link that also records an engagement event (e.g. a contact click) without delaying the navigation. */
export function TrackedLink({ productId, type, sellerSlug, method, onClick, onAuxClick, ...rest }: Props) {
  const track = () => { sendEvent(type, productId); if (type === 'contact' && sellerSlug && method) gaContactSeller({ sellerSlug, method, productId }); };
  return <a {...rest} onClick={e => { track(); onClick?.(e); }} onAuxClick={e => { if (e.button === 1) track(); onAuxClick?.(e); }} />;
}
