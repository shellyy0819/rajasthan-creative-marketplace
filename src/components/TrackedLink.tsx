'use client';
import type { AnchorHTMLAttributes } from 'react';
import { gaContactSeller, type GaContactMethod } from '@/lib/ga-events';
import { sendEvent, type TrackType } from '@/lib/track';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { productId: string; type: TrackType; href: string; sellerSlug?: string; method?: GaContactMethod; category?: string };

/** A normal link that also records an engagement event (e.g. a contact click) without delaying the navigation. */
export function TrackedLink({ productId, type, sellerSlug, method, category, onClick, onAuxClick, ...rest }: Props) {
  const track = () => { sendEvent(type, productId); if (type.startsWith('contact') && sellerSlug && method) gaContactSeller({ sellerSlug, method, productId, category }); };
  return <a {...rest} onClick={e => { track(); onClick?.(e); }} onAuxClick={e => { if (e.button === 1) track(); onAuxClick?.(e); }} />;
}
