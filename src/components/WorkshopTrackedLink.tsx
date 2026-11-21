'use client';
import type { AnchorHTMLAttributes } from 'react';
import { gaWorkshopContact, type GaContactMethod, type WorkshopPlacement } from '@/lib/ga-events';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; workshopId: string; method: GaContactMethod; placement: WorkshopPlacement; category?: string; contentType: 'class' | 'workshop' };

/** A contact link of a workshop (WhatsApp, Call, Instagram, Website) that reports the contact without delaying the navigation; a middle click counts too. */
export function WorkshopTrackedLink({ workshopId, method, placement, category, contentType, onClick, onAuxClick, ...rest }: Props) {
  const track = () => gaWorkshopContact({ workshopId, method, placement, category, contentType });
  return <a {...rest} onClick={e => { track(); onClick?.(e); }} onAuxClick={e => { if (e.button === 1) track(); onAuxClick?.(e); }} />;
}
