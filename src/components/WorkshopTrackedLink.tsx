'use client';
import type { AnchorHTMLAttributes } from 'react';
import { gaWorkshopContact, type GaContactMethod, type WorkshopPlacement } from '@/lib/ga-events';
import { sendWorkshopEvent, type WorkshopTrackType } from '@/lib/track';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; workshopId: string; method: GaContactMethod; placement: WorkshopPlacement; category?: string; contentType: 'class' | 'workshop' };

/** A contact link of a workshop (WhatsApp, Call, Instagram, Website) that reports the contact without delaying the navigation; a middle click counts too. */
export function WorkshopTrackedLink({ workshopId, method, placement, category, contentType, onClick, onAuxClick, ...rest }: Props) {
  const track = () => {
    gaWorkshopContact({ workshopId, method, placement, category, contentType });
    // The first-party counts behind Trending workshops: one "contact" (whatever the way), and the way used.
    sendWorkshopEvent('contact', workshopId);
    const own = `contact_${method}`;
    if ((['contact_whatsapp', 'contact_call', 'contact_instagram', 'contact_website'] as string[]).includes(own)) sendWorkshopEvent(own as WorkshopTrackType, workshopId);
  };
  return <a {...rest} onClick={e => { track(); onClick?.(e); }} onAuxClick={e => { if (e.button === 1) track(); onAuxClick?.(e); }} />;
}
