'use client';
import type { AnchorHTMLAttributes } from 'react';
import { gaEvent } from '@/lib/analytics';
import { sendEvent, type TrackType } from '@/lib/track';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { productId: string; type: TrackType; href: string };

/** A normal link that also records an engagement event (e.g. a contact click) without delaying the navigation. */
export function TrackedLink({ productId, type, onClick, onAuxClick, ...rest }: Props) {
  const track = () => { sendEvent(type, productId); gaEvent(type === 'contact' ? 'contact_click' : 'artist_visit', { item_id: productId }); };
  return <a {...rest} onClick={e => { track(); onClick?.(e); }} onAuxClick={e => { if (e.button === 1) track(); onAuxClick?.(e); }} />;
}
